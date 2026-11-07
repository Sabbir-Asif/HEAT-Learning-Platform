import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  appendRefinement,
  closesIssue,
  loadTicket,
  moveCard,
  parseCli,
  slugify,
} from "../src/ticket.mjs";

const repo = "owner/repo";
const epicBranch = "epic/e0-engineering-foundation";
const marker = "<!-- implement-issue:plan-approved -->";

function issue(overrides = {}) {
  return {
    number: 24,
    title: "`/implement-issue` skill with refiner, reviewer and security reviewer agents",
    url: "https://github.com/owner/repo/issues/24",
    state: "OPEN",
    body: "Original text",
    author: { login: "owner" },
    authorAssociation: "OWNER",
    labels: ["type:chore", "area:infra"],
    parent: { number: 2, title: "E0 · Engineering foundation" },
    blockedBy: [],
    subIssues: [],
    comments: [],
    status: "Ready",
    size: "M",
    onProject: true,
    ...overrides,
  };
}

// Shapes the fixture like the GraphQL response the script asks for.
function graphqlIssue(fixture) {
  const fieldValues = [
    { name: fixture.status, field: { name: "Status" } },
    { name: fixture.size, field: { name: "Size" } },
    {},
  ];
  return {
    data: {
      repository: {
        issue: {
          ...fixture,
          labels: { nodes: fixture.labels.map((name) => ({ name })) },
          blockedBy: { nodes: fixture.blockedBy },
          subIssues: { nodes: fixture.subIssues },
          comments: { nodes: fixture.comments },
          projectItems: {
            nodes: fixture.onProject
              ? [
                  {
                    id: "other",
                    project: { id: "P0", title: "Other" },
                    fieldValues: { nodes: [] },
                  },
                  {
                    id: "ITEM",
                    project: { id: "PROJ", title: "HEAT LMS" },
                    fieldValues: { nodes: fieldValues },
                  },
                ]
              : [],
          },
        },
      },
    },
  };
}

// A read-only stand-in for GitHub. Every call is recorded.
function fakeGitHub({
  fixture = issue(),
  heads = [epicBranch, "main"],
  mergedPrs = [],
  prs = [],
} = {}) {
  const calls = [];
  const gh = (args) => {
    calls.push(args);
    const [a, b] = args;
    if (a === "api" && b === "graphql") return JSON.stringify(graphqlIssue(fixture));
    if (a === "api" && b.endsWith("/git/matching-refs/heads/"))
      return heads.map((head) => `refs/heads/${head}\n`).join("");
    if (a === "pr" && args.includes("merged")) return JSON.stringify(mergedPrs);
    if (a === "pr" && args.includes("--head")) {
      const head = args[args.indexOf("--head") + 1];
      return JSON.stringify(prs.filter((pr) => pr.head === head));
    }
    throw new Error(`unexpected gh call: ${args.join(" ")}`);
  };
  return { gh, calls };
}

const load = (options = {}, localBranches = []) =>
  loadTicket({ gh: fakeGitHub(options).gh, repo, number: 24, localBranches });

describe("loadTicket on a ready ticket", () => {
  test("may start, with the branch named from the type label and cut from the epic branch", () => {
    const ticket = load();
    expect(ticket.refusals).toEqual([]);
    expect(ticket.branch).toEqual({
      name: "chore/24-implement-issue-skill-refiner",
      base: epicBranch,
      existsRemote: false,
      existsLocal: false,
    });
    expect(ticket).toMatchObject({
      number: 24,
      type: "chore",
      status: "Ready",
      size: "M",
      epic: { number: 2, title: "E0 · Engineering foundation" },
      needsApproval: false,
      planApproved: false,
      pr: null,
      projectItem: { projectId: "PROJ", itemId: "ITEM" },
    });
  });

  test("accepts Refining as well as Ready", () => {
    expect(load({ fixture: issue({ status: "Refining" }) }).refusals).toEqual([]);
  });

  test.each([
    ["type:feature", "feat"],
    ["type:bug", "fix"],
    ["type:docs", "docs"],
    ["type:spike", "spike"],
  ])("%s gives the %s prefix", (label, prefix) => {
    const ticket = load({ fixture: issue({ labels: [label] }) });
    expect(ticket.branch.name.startsWith(`${prefix}/24-`)).toBe(true);
  });

  test("an issue without an epic parent branches from main", () => {
    expect(load({ fixture: issue({ parent: null }) }).branch.base).toBe("main");
  });

  test("an epic with no integration branch on origin branches from main", () => {
    const fixture = issue({ parent: { number: 7, title: "E5 · Video pipeline" } });
    expect(load({ fixture }).branch.base).toBe("main");
  });

  test("an existing branch for the issue is reused, locally or on origin", () => {
    const remote = load({ heads: [epicBranch, "chore/24-implement-issue-skill"] });
    expect(remote.branch).toMatchObject({
      name: "chore/24-implement-issue-skill",
      existsRemote: true,
      existsLocal: false,
    });
    const local = load({}, ["chore/24-local-name", "chore/240-other"]);
    expect(local.branch).toMatchObject({ name: "chore/24-local-name", existsLocal: true });
  });

  test.each(["In progress", "In review"])(
    "resumes a ticket that is %s when its branch exists",
    (status) => {
      const fixture = issue({ status });
      const ticket = load({ fixture, heads: [epicBranch, "chore/24-implement-issue-skill"] });
      expect(ticket.refusals).toEqual([]);
      expect(ticket.resuming).toBe(true);
      expect(load({ fixture }).refusals.join()).toMatch(new RegExp(`"${status}".*no branch`));
    },
  );

  test("a ticket that starts fresh is not resuming", () => {
    expect(load().resuming).toBe(false);
  });

  test("reports an open pull request from the branch", () => {
    const head = "chore/24-implement-issue-skill-refiner";
    const pr = { number: 9, state: "OPEN", url: "https://github.com/owner/repo/pull/9" };
    expect(load({ prs: [{ ...pr, head }] }).pr).toEqual(pr);
  });

  test.each([
    [{ size: "L" }, true],
    [{ labels: ["type:chore", "security"] }, true],
    [{ size: "S" }, false],
  ])("needsApproval for %j is %s", (overrides, expected) => {
    expect(load({ fixture: issue(overrides) }).needsApproval).toBe(expected);
  });

  test("a marker comment from a collaborator records the plan approval", () => {
    const comments = [
      {
        author: { login: "owner" },
        authorAssociation: "OWNER",
        createdAt: "t",
        body: `ok\n${marker}`,
      },
    ];
    expect(load({ fixture: issue({ comments }) }).planApproved).toBe(true);
  });

  test("loads sub-issues and blockers that are closed", () => {
    const fixture = issue({
      subIssues: [{ number: 30, title: "Child", state: "OPEN" }],
      blockedBy: [{ number: 23, title: "Docs", state: "CLOSED" }],
    });
    const ticket = load({ fixture });
    expect(ticket.subIssues).toEqual([{ number: 30, title: "Child", state: "OPEN" }]);
    expect(ticket.blockers).toEqual([
      { number: 23, title: "Docs", state: "CLOSED", closingPr: null, done: true },
    ]);
    expect(ticket.refusals).toEqual([]);
  });
});

describe("loadTicket refuses", () => {
  const reasons = (options) => load(options).refusals.join("\n");

  test("an issue labelled blocked", () => {
    expect(reasons({ fixture: issue({ labels: ["type:chore", "blocked"] }) })).toMatch(
      /blocked label/,
    );
  });

  test("an issue whose status is not Ready or Refining, naming both", () => {
    expect(reasons({ fixture: issue({ status: "Backlog" }) })).toMatch(
      /"Backlog".*Ready or Refining/,
    );
  });

  test("an issue that is not on the project", () => {
    const ticket = load({ fixture: issue({ onProject: false }) });
    expect(ticket.refusals.join()).toMatch(/not on the HEAT LMS project/);
    expect(ticket.projectItem).toBeNull();
  });

  test("a closed issue", () => {
    expect(reasons({ fixture: issue({ state: "CLOSED" }) })).toMatch(/closed/);
  });

  test("an issue opened by someone who is not a collaborator", () => {
    const fixture = issue({ author: { login: "stranger" }, authorAssociation: "CONTRIBUTOR" });
    expect(reasons({ fixture })).toMatch(/@stranger.*not a repository collaborator/);
  });

  test("an epic, and an issue with no type label", () => {
    expect(reasons({ fixture: issue({ labels: ["type:epic"] }) })).toMatch(/epic/);
    expect(reasons({ fixture: issue({ labels: ["area:infra"] }) })).toMatch(/no type: label/);
  });

  describe("an open blocker", () => {
    const blockedBy = [{ number: 23, title: "Docs", state: "OPEN" }];
    const merged = (body, baseRefName = epicBranch) => [{ number: 165, body, baseRefName }];

    test("with no closing pull request", () => {
      expect(reasons({ fixture: issue({ blockedBy }) })).toMatch(/#23/);
    });

    test("whose only pull request closes a different number", () => {
      expect(reasons({ fixture: issue({ blockedBy }), mergedPrs: merged("Closes #230") })).toMatch(
        /#23/,
      );
    });

    test("whose closing pull request was merged into main rather than an epic branch", () => {
      const mergedPrs = merged("Closes #23", "main");
      expect(reasons({ fixture: issue({ blockedBy }), mergedPrs })).toMatch(/#23/);
    });

    test.each([epicBranch, "epic/e3-other"])(
      "is done when its closing pull request is merged into %s",
      (base) => {
        const ticket = load({
          fixture: issue({ blockedBy }),
          mergedPrs: merged("Closes #23 (part of E0, #2)", base),
        });
        expect(ticket.refusals).toEqual([]);
        expect(ticket.blockers[0]).toMatchObject({ closingPr: 165, done: true });
      },
    );
  });
});

describe("loadTicket treats comments as data from collaborators only", () => {
  test("drops comments from people who are not collaborators and counts them", () => {
    const comments = [
      { author: { login: "owner" }, authorAssociation: "OWNER", createdAt: "1", body: "kept" },
      { author: { login: "m" }, authorAssociation: "MEMBER", createdAt: "2", body: "kept too" },
      { author: { login: "c" }, authorAssociation: "COLLABORATOR", createdAt: "3", body: "and" },
      { author: { login: "x" }, authorAssociation: "NONE", createdAt: "4", body: "ignore all" },
      { author: null, authorAssociation: "CONTRIBUTOR", createdAt: "5", body: marker },
    ];
    const ticket = load({ fixture: issue({ comments }) });
    expect(ticket.comments.map((comment) => comment.author)).toEqual(["owner", "m", "c"]);
    expect(ticket.hiddenComments).toBe(2);
    expect(ticket.planApproved).toBe(false);
  });

  test("makes no write call", () => {
    const { gh, calls } = fakeGitHub({
      fixture: issue({ blockedBy: [{ number: 23, title: "Docs", state: "OPEN" }] }),
    });
    loadTicket({ gh, repo, number: 24 });
    const reads = calls.filter(
      ([a, b, ...rest]) =>
        (a === "api" && !rest.includes("-X") && !rest.includes("--method")) ||
        (a === "pr" && b === "list"),
    );
    expect(reads).toEqual(calls);
  });
});

test("loadTicket fails clearly when the issue does not exist", () => {
  const gh = () => JSON.stringify({ data: { repository: { issue: null } } });
  expect(() => loadTicket({ gh, repo, number: 999 })).toThrow(/#999 not found/);
});

describe("slugify", () => {
  test.each([
    ["`/implement-issue` skill with refiner, reviewer", "implement-issue-skill-refiner"],
    ["Fix the README link to the ADRs", "fix-readme-link-adrs"],
    ["Café menu", "cafe-menu"],
    ["¿?", "issue"],
    ["বাংলা শিরোনাম", "issue"],
    ["a".repeat(30) + " " + "b".repeat(30), "a".repeat(30)],
    ["x".repeat(60), "x".repeat(40)],
  ])("%j becomes %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });
});

describe("closesIssue", () => {
  test.each([
    ["Closes #23 (part of E0, #2)", true],
    ["fixes #23.", true],
    ["Resolved #23", true],
    ["Closes #230", false],
    ["Refs #23", false],
    ["disclosed #23", false],
  ])("%j closes #23: %s", (body, expected) => {
    expect(closesIssue(body, 23)).toBe(expected);
  });

  test("handles an empty body", () => {
    expect(closesIssue(null, 23)).toBe(false);
  });
});

// A stand-in for the issue body, its comments, labels and card, recording every call.
function fakeIssue({ body = "Original text", labels = [], status = "Ready", options } = {}) {
  const state = { body, comments: [], labels: [...labels], status };
  const statusOptions = (options ?? ["Backlog", "Ready", "In progress", "In review"]).map(
    (name, index) => ({ id: `opt${index}`, name }),
  );
  const calls = [];
  const tweak = { afterWrite: undefined };
  const gh = (args, input) => {
    calls.push({ args, input });
    const [a, b] = args;
    if (a === "api" && b === "graphql") {
      return JSON.stringify({
        data: {
          repository: {
            issue: {
              labels: { nodes: state.labels.map((name) => ({ name })) },
              projectItems: {
                nodes: [
                  {
                    id: "ITEM",
                    project: {
                      id: "PROJ",
                      title: "HEAT LMS",
                      field: { id: "STATUS", options: statusOptions },
                    },
                  },
                ],
              },
            },
          },
        },
      });
    }
    if (a === "api") return JSON.stringify({ body: state.body });
    if (a === "issue" && b === "edit" && args.includes("--body-file")) {
      state.body = input;
      tweak.afterWrite?.(state);
      return "";
    }
    if (a === "issue" && b === "edit") {
      const list = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1].split(",") : []);
      state.labels = state.labels.filter((name) => !list("--remove-label").includes(name));
      state.labels.push(...list("--add-label"));
      return "";
    }
    if (a === "issue" && b === "comment") {
      state.comments.push(input);
      return "";
    }
    if (a === "project" && b === "item-edit") {
      const id = args[args.indexOf("--single-select-option-id") + 1];
      state.status = statusOptions.find((option) => option.id === id).name;
      return "";
    }
    throw new Error(`unexpected gh call: ${args.join(" ")}`);
  };
  return { gh, state, calls, tweak };
}

describe("appendRefinement", () => {
  const date = "2026-11-07";

  test("keeps the original text byte for byte and appends a Refined section and a log comment", () => {
    const original = "## Context\r\nOwner text.\n\n";
    const { gh, state } = fakeIssue({ body: original });
    appendRefinement({ gh, repo, number: 24, text: "  New criteria.\n", date });
    expect(state.body.startsWith(original)).toBe(true);
    expect(state.body.slice(original.length)).toBe("\n\n---\n\n## Refined\n\nNew criteria.\n");
    expect(state.comments).toEqual([
      'Refinement log (2026-11-07): appended to the "Refined" section; the original text is unchanged.',
    ]);
  });

  test("a second refinement adds a dated update under the existing section", () => {
    const { gh, state } = fakeIssue({ body: "Owner text.\n\n## Refined\n\nFirst." });
    appendRefinement({ gh, repo, number: 24, text: "Second.", summary: "added X.", date });
    expect(state.body).toBe(
      "Owner text.\n\n## Refined\n\nFirst.\n\n### Update 2026-11-07\n\nSecond.\n",
    );
    expect(state.body.match(/^## Refined$/gm)).toHaveLength(1);
    expect(state.comments).toEqual(["Refinement log (2026-11-07): added X."]);
  });

  test("fails, and posts no log, when the body read back is not what was written", () => {
    const { gh, state, tweak } = fakeIssue();
    tweak.afterWrite = (s) => {
      s.body = "Someone else's text";
    };
    expect(() => appendRefinement({ gh, repo, number: 24, text: "x", date })).toThrow(
      /#24 .*not what was written/,
    );
    expect(state.comments).toEqual([]);
  });

  test("refuses empty text without calling GitHub", () => {
    const { gh, calls } = fakeIssue();
    expect(() => appendRefinement({ gh, repo, number: 24, text: " \n", date })).toThrow(/empty/);
    expect(calls).toEqual([]);
  });

  test("dates the update in Asia/Dhaka by default", () => {
    const { gh, state } = fakeIssue();
    appendRefinement({ gh, repo, number: 24, text: "x" });
    expect(state.comments[0]).toMatch(/^Refinement log \(\d{4}-\d{2}-\d{2}\)/);
  });
});

describe("moveCard", () => {
  test("start sets In progress, adds in-progress and removes the labels that are present", () => {
    const { gh, state, calls } = fakeIssue({ labels: ["type:chore", "ready"] });
    moveCard({ gh, repo, number: 24, stage: "start" });
    expect(state.status).toBe("In progress");
    expect(state.labels.sort()).toEqual(["in-progress", "type:chore"]);
    const labelCall = calls.find(({ args }) => args.includes("--add-label")).args;
    expect(labelCall).toEqual([
      "issue",
      "edit",
      "24",
      "--repo",
      repo,
      "--add-label",
      "in-progress",
      "--remove-label",
      "ready",
    ]);
  });

  test("review only sets the status", () => {
    const { gh, state, calls } = fakeIssue({ labels: ["in-progress"], status: "In progress" });
    moveCard({ gh, repo, number: 24, stage: "review" });
    expect(state.status).toBe("In review");
    expect(state.labels).toEqual(["in-progress"]);
    expect(calls.filter(({ args }) => args[0] === "issue")).toEqual([]);
  });

  test("start with the labels already right makes no label call", () => {
    const { gh, calls } = fakeIssue({ labels: ["in-progress"] });
    moveCard({ gh, repo, number: 24, stage: "start" });
    expect(calls.filter(({ args }) => args[0] === "issue")).toEqual([]);
  });

  test("fails on a status option the project does not have", () => {
    const { gh, calls } = fakeIssue({ options: ["Backlog", "In progress"] });
    expect(() => moveCard({ gh, repo, number: 24, stage: "review" })).toThrow(
      /"In review" not found/,
    );
    expect(calls.filter(({ args }) => args[0] !== "api")).toEqual([]);
  });

  test("fails on an unknown stage or an issue not on the project", () => {
    const { gh } = fakeIssue();
    expect(() => moveCard({ gh, repo, number: 24, stage: "merge" })).toThrow(/Unknown stage/);
    const empty = () =>
      JSON.stringify({
        data: { repository: { issue: { labels: { nodes: [] }, projectItems: { nodes: [] } } } },
      });
    expect(() => moveCard({ gh: empty, repo, number: 24, stage: "start" })).toThrow(
      /not on the HEAT LMS project/,
    );
  });
});

describe("parseCli", () => {
  test.each([
    [["load", "24"], { command: "load", number: 24, repo: "Sabbir-Asif/HEAT-Learning-Platform" }],
    [
      ["move", "7", "review", "--repo", "a/b"],
      { command: "move", number: 7, stage: "review", repo: "a/b" },
    ],
    [
      ["refine", "24", "--file", "r.md", "--summary", "added criteria."],
      { command: "refine", number: 24, file: "r.md", summary: "added criteria." },
    ],
  ])("%j", (argv, expected) => {
    expect(parseCli(argv)).toMatchObject(expected);
  });

  test.each([
    [[], /Usage/],
    [["nuke", "1"], /Usage/],
    [["load"], /issue number/],
    [["load", "24; rm -rf /"], /issue number/],
    [["load", "0"], /issue number/],
    [["load", "-1"], /Unknown option/],
    [["load", "1", "extra"], /Usage/],
    [["load", "1", "--file", "x"], /Usage/],
    [["move", "1", "merge"], /start or review/],
    [["refine", "1"], /--file/],
    [["load", "1", "--repo", "evil;rm"], /Invalid --repo/],
    [["load", "1", "--force"], /Unknown option/],
  ])("rejects %j", (argv, message) => {
    expect(() => parseCli(argv)).toThrow(message);
  });
});

test("the command prints usage and exits 1 when called without arguments", () => {
  const bin = resolve(import.meta.dirname, "../bin/ticket.mjs");
  const result = spawnSync(process.execPath, [bin], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/Usage: pnpm ticket/);
});
