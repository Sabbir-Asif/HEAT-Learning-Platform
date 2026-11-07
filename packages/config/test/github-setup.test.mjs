import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { load as parse } from "js-yaml";
import {
  areas,
  defaultProjectTitle,
  defaultRepo,
  labels,
  milestones,
  parseCli,
  projectFields,
  setup,
} from "../src/github-setup.mjs";

const root = resolve(import.meta.dirname, "../../..");
const repo = "owner/repo";
const owner = "owner";
const flag = (args, name) => args[args.indexOf(name) + 1];

// A stateful stand-in for the parts of GitHub the script talks to. Every call is recorded.
function fakeGitHub(initial = {}) {
  const state = {
    labels: [],
    milestones: [],
    projects: [],
    fields: [],
    ...structuredClone(initial),
  };
  const calls = [];
  // Hooks that let a test change GitHub between the script's calls.
  const tweak = { beforeRead: undefined, regenerateIds: false };
  let reads = 0;
  const ids = (() => {
    let next = 0;
    return () => `id${(next += 1)}`;
  })();
  const options = (names) => names.map((name) => ({ id: ids(), name }));

  const gh = (args, input) => {
    const [a, b] = args;
    const read = (value) => JSON.stringify(value);
    if (a === "label" && b === "list") {
      calls.push({ write: false, args });
      return read(state.labels);
    }
    if (a === "label") {
      calls.push({ write: true, args });
      const next = {
        name: args[2],
        color: flag(args, "--color"),
        description: flag(args, "--description"),
      };
      const at = state.labels.findIndex((l) => l.name.toLowerCase() === args[2].toLowerCase());
      if (b === "create") state.labels.push(next);
      else state.labels[at] = next;
      return "";
    }
    if (a === "api" && args.includes("--paginate")) {
      calls.push({ write: false, args });
      return read([state.milestones]);
    }
    if (a === "api" && args.includes("POST")) {
      calls.push({ write: true, args });
      state.milestones.push({ title: flag(args, "-f").replace("title=", "") });
      return "";
    }
    if (a === "api" && args[1] === "graphql" && !input) {
      calls.push({ write: false, args });
      reads += 1;
      tweak.beforeRead?.(reads, state);
      const id = args.find((arg) => arg.startsWith("id=")).slice(3);
      const field = state.fields.find((f) => f.id === id);
      return read({
        data: {
          node: {
            options: field.options.map((o) => ({ ...o, color: "BLUE", description: "kept" })),
          },
        },
      });
    }
    if (a === "api" && args[1] === "graphql") {
      calls.push({ write: true, args, input });
      const { fieldId, singleSelectOptions } = JSON.parse(input).variables.input;
      const field = state.fields.find((f) => f.id === fieldId);
      field.options = singleSelectOptions.map((o) => ({
        ...o,
        id: tweak.regenerateIds ? ids() : (o.id ?? ids()),
      }));
      return "";
    }
    if (a === "project" && b === "list") {
      calls.push({ write: false, args });
      return read({ projects: state.projects });
    }
    if (a === "project" && b === "create") {
      calls.push({ write: true, args });
      state.projects.push({ number: 7, title: flag(args, "--title") });
      return read({ number: 7 });
    }
    if (a === "project" && b === "field-list") {
      calls.push({ write: false, args });
      return read({ fields: state.fields });
    }
    if (a === "project" && b === "field-create") {
      calls.push({ write: true, args });
      state.fields.push({
        id: ids(),
        name: flag(args, "--name"),
        type: "ProjectV2SingleSelectField",
        options: options(flag(args, "--single-select-options").split(",")),
      });
      return "";
    }
    throw new Error(`unexpected gh call: ${args.join(" ")}`);
  };
  const writes = () => calls.filter((call) => call.write);
  return { gh, state, calls, writes, tweak };
}

const run = (fake, extra = {}) => {
  const lines = [];
  const result = setup({
    gh: fake.gh,
    repo,
    owner,
    projectTitle: defaultProjectTitle,
    log: (line) => lines.push(line),
    ...extra,
  });
  return { ...result, lines };
};

// The only kinds of write the script may ever make: nothing deletes or renames.
const writeKind = ({ args }) => {
  const [a, b] = args;
  if (a === "api") return args.includes("POST") ? "api POST" : "api graphql";
  return `${a} ${b}`;
};
const allowedWrites = [
  "label create",
  "label edit",
  "api POST",
  "project create",
  "project field-create",
  "api graphql",
];

describe("setup on an empty repository", () => {
  test("creates every label, milestone, project and field", () => {
    const fake = fakeGitHub();
    const { changes, problems } = run(fake);
    expect(problems).toEqual([]);
    expect(changes).toBe(labels.length + milestones.length + 1 + projectFields.length);
    expect(fake.state.labels.map((l) => l.name)).toEqual(labels.map((l) => l.name));
    expect(fake.state.milestones.map((m) => m.title)).toEqual(milestones);
    expect(fake.state.projects).toEqual([{ number: 7, title: defaultProjectTitle }]);
    expect(fake.state.fields.map((f) => [f.name, f.options.map((o) => o.name)])).toEqual(
      projectFields.map((f) => [f.name, f.options]),
    );
    expect(
      fake
        .writes()
        .map(writeKind)
        .filter((k) => !allowedWrites.includes(k)),
    ).toEqual([]);
  });

  test("a second run changes nothing and makes no write call", () => {
    const fake = fakeGitHub();
    run(fake);
    const before = structuredClone(fake.state);
    const writesAfterFirst = fake.writes().length;
    const second = run(fake);
    expect(second.changes).toBe(0);
    expect(fake.writes()).toHaveLength(writesAfterFirst);
    expect(fake.state).toEqual(before);
    expect(second.lines).toEqual(["Made 0 changes."]);
  });

  test("a dry run plans every change and makes none", () => {
    const fake = fakeGitHub();
    const { changes, lines } = run(fake, { dryRun: true });
    expect(changes).toBe(labels.length + milestones.length + 1 + projectFields.length);
    expect(fake.writes()).toEqual([]);
    expect(fake.state).toEqual({ labels: [], milestones: [], projects: [], fields: [] });
    expect(lines[0]).toBe(`would create label ${labels[0].name}`);
    expect(lines.at(-1)).toBe(`Planned ${changes} changes.`);
  });
});

describe("setup on an existing repository", () => {
  const complete = () => {
    const fake = fakeGitHub();
    run(fake);
    return fake;
  };

  test("updates a label with another colour or description in place", () => {
    const fake = complete();
    const index = fake.state.labels.findIndex((l) => l.name === "security");
    fake.state.labels[index] = { name: "security", color: "ffffff", description: "old" };
    const other = fake.state.labels.length;
    const { changes, lines } = run(fake);
    expect(changes).toBe(1);
    expect(lines[0]).toBe("update label security");
    expect(fake.state.labels).toHaveLength(other);
    expect(fake.state.labels[index]).toEqual(labels.find((l) => l.name === "security"));
  });

  test.each([
    ["colour", { color: "ffffff" }],
    ["description", { description: "something else" }],
  ])("updates a label in place when only the %s differs", (_, drift) => {
    const fake = complete();
    const index = fake.state.labels.findIndex((l) => l.name === "security");
    fake.state.labels[index] = { ...fake.state.labels[index], ...drift };
    const other = fake.state.labels.length;
    const { changes, lines } = run(fake);
    expect(changes).toBe(1);
    expect(lines[0]).toBe("update label security");
    expect(fake.state.labels).toHaveLength(other);
    expect(fake.state.labels[index]).toEqual(labels.find((l) => l.name === "security"));
  });

  test("treats colour case, a missing description and label name case as the same label", () => {
    const fake = complete();
    fake.state.labels = fake.state.labels.map((l) =>
      l.name === "ready" ? { ...l, name: "Ready", color: l.color.toUpperCase() } : l,
    );
    fake.state.labels.find((l) => l.name === "blocked").description = null;
    const { lines } = run(fake);
    expect(lines).toEqual(["update label blocked", "Made 1 change."]);
    expect(fake.state.labels.filter((l) => l.name.toLowerCase() === "ready")).toHaveLength(1);
    expect(fake.state.labels.some((l) => l.name === "Ready")).toBe(true);
  });

  test("leaves extra labels, milestones and options alone and reports the options", () => {
    const fake = complete();
    fake.state.labels.push({ name: "bug", color: "d73a4a", description: "" });
    fake.state.milestones.push({ title: "Someday" });
    fake.state.fields.find((f) => f.name === "Phase").options.push({ id: "x", name: "Later" });
    const { changes, lines } = run(fake);
    expect(changes).toBe(0);
    expect(lines).toContain("keep extra option Later on field Phase");
    expect(
      fake
        .writes()
        .map(writeKind)
        .filter((k) => !allowedWrites.includes(k)),
    ).toEqual([]);
    expect(fake.state.labels.some((l) => l.name === "bug")).toBe(true);
    expect(fake.state.milestones.some((m) => m.title === "Someday")).toBe(true);
  });

  test("adds a missing option and keeps the ids of the existing ones", () => {
    const fake = complete();
    const size = fake.state.fields.find((f) => f.name === "Size");
    const idsBefore = size.options.slice(0, 2).map((o) => o.id);
    size.options = size.options.slice(0, 2);
    const { changes, lines } = run(fake);
    expect(changes).toBe(1);
    expect(lines).toContain("add option L to field Size");
    expect(size.options.map((o) => o.name)).toEqual(["S", "M", "L"]);
    expect(size.options.slice(0, 2).map((o) => o.id)).toEqual(idsBefore);
    const mutation = fake.writes().at(-1);
    expect(JSON.parse(mutation.input).variables.input.singleSelectOptions).toEqual([
      { id: idsBefore[0], name: "S", color: "BLUE", description: "kept" },
      { id: idsBefore[1], name: "M", color: "BLUE", description: "kept" },
      { name: "L", color: "GRAY", description: "" },
    ]);
  });

  test("prints the options before writing so they can be restored", () => {
    const fake = complete();
    const size = fake.state.fields.find((f) => f.name === "Size");
    size.options = size.options.slice(0, 2);
    const { lines } = run(fake);
    const backup = lines.find((line) => line.startsWith("backup of field Size options"));
    expect(backup).toContain(JSON.stringify(size.options.slice(0, 2).map((o) => o.id)[0]));
    expect(lines.indexOf(backup)).toBeLessThan(lines.indexOf("add option L to field Size"));
  });

  test("writes nothing when an option was added between the field list and the first read", () => {
    const fake = complete();
    const size = fake.state.fields.find((f) => f.name === "Size");
    size.options = size.options.slice(0, 2);
    fake.tweak.beforeRead = (n) => n === 1 && size.options.push({ id: "web", name: "XL" });
    expect(() => run(fake)).toThrow(/Size changed while reading; nothing was written/);
    expect(fake.writes().filter((w) => w.args[1] === "graphql")).toEqual([]);
  });

  test("writes nothing when an option changed between the two reads", () => {
    const fake = complete();
    const size = fake.state.fields.find((f) => f.name === "Size");
    size.options = size.options.slice(0, 2);
    fake.tweak.beforeRead = (n) => n === 2 && size.options.push({ id: "web", name: "XL" });
    expect(() => run(fake)).toThrow(/Size changed before the write; nothing was written/);
    expect(fake.writes().filter((w) => w.args[1] === "graphql")).toEqual([]);
    expect(size.options.map((o) => o.name)).toEqual(["S", "M", "XL"]);
  });

  test("fails loudly when the read-back shows the option ids were regenerated", () => {
    const fake = complete();
    const size = fake.state.fields.find((f) => f.name === "Size");
    size.options = size.options.slice(0, 2);
    fake.tweak.regenerateIds = true;
    expect(() => run(fake)).toThrow(/Size options changed unexpectedly after the write.*Restore/);
  });

  test("fails loudly when the read-back is missing the new option", () => {
    const fake = complete();
    const size = fake.state.fields.find((f) => f.name === "Size");
    size.options = size.options.slice(0, 2);
    fake.tweak.beforeRead = (n) => {
      if (n === 3) size.options = size.options.filter((o) => o.name !== "L");
    };
    expect(() => run(fake)).toThrow(/not added: \["L"\]/);
  });

  test("reports a closed project instead of creating a second one", () => {
    const fake = fakeGitHub({
      projects: [{ number: 4, title: defaultProjectTitle, closed: true }],
    });
    expect(() => run(fake)).toThrow(/is closed/);
    expect(fake.writes().filter((w) => w.args[0] === "project")).toEqual([]);
  });

  test("lists closed projects and prefers an open one with the same title", () => {
    const fake = fakeGitHub({
      projects: [
        { number: 4, title: defaultProjectTitle, closed: true },
        { number: 11, title: defaultProjectTitle, closed: false },
      ],
    });
    run(fake);
    const list = fake.calls.find((c) => c.args[1] === "list" && c.args[0] === "project");
    expect(list.args).toContain("--closed");
    expect(fake.calls.find((c) => c.args[1] === "field-list").args[2]).toBe("11");
  });

  test("refuses to create a project when the list is full and may hide the real one", () => {
    const projects = Array.from({ length: 100 }, (_, i) => ({ number: i, title: `P${i}` }));
    const fake = fakeGitHub({ projects });
    expect(() => run(fake)).toThrow(/100\+ projects/);
    expect(fake.writes().filter((w) => w.args[0] === "project")).toEqual([]);
  });

  test("a dry run reports a missing option without reading or writing", () => {
    const fake = complete();
    const callsBefore = fake.calls.length;
    const priority = fake.state.fields.find((f) => f.name === "Priority");
    priority.options = priority.options.slice(0, 1);
    const { lines } = run(fake, { dryRun: true });
    expect(lines[0]).toBe("would add options P1, P2 to field Priority");
    expect(fake.calls.slice(callsBefore).filter((c) => c.args[1] === "graphql")).toEqual([]);
    expect(fake.writes().filter((w) => w.args[1] === "graphql")).toEqual([]);
  });

  test("reports a field of the wrong type instead of touching it", () => {
    const fake = complete();
    fake.state.fields.find((f) => f.name === "Epic").type = "ProjectV2Field";
    const { changes, problems } = run(fake);
    expect(changes).toBe(0);
    expect(problems).toEqual([
      "Field Epic is ProjectV2Field, expected a single select; left unchanged",
    ]);
  });

  test("finds the project by title and skips creating it", () => {
    const fake = fakeGitHub({
      projects: [
        { number: 3, title: "Other" },
        { number: 11, title: defaultProjectTitle },
      ],
    });
    run(fake);
    expect(fake.state.projects).toHaveLength(2);
    expect(fake.calls.find((c) => c.args[1] === "field-list").args[2]).toBe("11");
  });
});

describe("what the script manages", () => {
  test("Area options are exactly the area:* labels", () => {
    const fromLabels = labels.filter((l) => l.name.startsWith("area:")).map((l) => l.name.slice(5));
    expect(projectFields.find((f) => f.name === "Area").options).toEqual(fromLabels);
    expect(fromLabels).toEqual(areas);
  });

  test("covers the labels, milestones and fields the ticket lists", () => {
    const names = labels.map((l) => l.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "type:feature",
        "type:bug",
        "type:spike",
        "type:chore",
        "type:epic",
        "security",
        "needs-refinement",
        "ready",
        "blocked",
        "in-progress",
      ]),
    );
    expect(milestones.slice(0, 8).map((m) => m.slice(0, 2))).toEqual(
      Array.from({ length: 8 }, (_, i) => `P${i}`),
    );
    expect(projectFields.map((f) => f.name)).toEqual([
      "Status",
      "Epic",
      "Phase",
      "Priority",
      "Size",
      "Area",
    ]);
    expect(projectFields.find((f) => f.name === "Epic").options).toHaveLength(17);
    expect(projectFields.find((f) => f.name === "Status").options).toEqual([
      "Backlog",
      "Refining",
      "Ready",
      "In progress",
      "In review",
      "Done",
    ]);
  });

  test("label names are unique ignoring case, colours are hex and descriptions fit GitHub's limit", () => {
    const names = labels.map((l) => l.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const label of labels) {
      expect(label.color).toMatch(/^[0-9a-f]{6}$/);
      expect(label.description.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("command line", () => {
  test("defaults to the HEAT repository and a real run", () => {
    expect(parseCli([])).toEqual({
      dryRun: false,
      repo: defaultRepo,
      owner: "Sabbir-Asif",
      projectTitle: defaultProjectTitle,
    });
  });

  test("reads the flags", () => {
    expect(parseCli(["--dry-run", "--repo", "a/b", "--owner", "c", "--project", "P"])).toEqual({
      dryRun: true,
      repo: "a/b",
      owner: "c",
      projectTitle: "P",
    });
  });

  test("rejects a malformed repository and unknown flags", () => {
    expect(() => parseCli(["--repo", "not-a-repo"])).toThrow('Invalid --repo "not-a-repo"');
    expect(() => parseCli(["--delete"])).toThrow();
  });

  test.each([
    "../..",
    "a/..",
    "a/.",
    "a/b/c",
    "/b",
    "a/",
    "-a/b",
    "a--/b",
    "a b/c",
    "a/b c",
    "a/b;x",
  ])("rejects the repository %j before any call", (repo) => {
    expect(() => parseCli([`--repo=${repo}`])).toThrow(/Invalid --repo/);
    const gh = () => {
      throw new Error("gh must not be called");
    };
    expect(() => setup({ gh, repo, owner, projectTitle: "P" })).toThrow(/Invalid --repo/);
  });

  test.each(["", "x y", "-x", "x-", "a/b", "../x", "x".repeat(40)])(
    "rejects the owner %j before any call",
    (bad) => {
      expect(() => parseCli([`--owner=${bad}`])).toThrow(/Invalid --owner/);
      const gh = () => {
        throw new Error("gh must not be called");
      };
      expect(() => setup({ gh, repo, owner: bad, projectTitle: "P" })).toThrow(/Invalid --owner/);
    },
  );

  test("accepts ordinary names", () => {
    expect(
      parseCli(["--repo", "Sabbir-Asif/HEAT-Learning-Platform.v2_x", "--owner", "a-b"]).owner,
    ).toBe("a-b");
  });

  describe("with a stub gh as the only program on PATH (no network, no credentials)", () => {
    // PATH holds only this directory, so a stub that cannot run fails the test instead of reaching a
    // real gh. The stub logs every call to the file named in STUB_LOG and answers reads with an
    // empty GitHub.
    const dir = mkdtempSync(join(tmpdir(), "gh-stub-"));
    writeFileSync(
      join(dir, "stub.js"),
      `const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.STUB_LOG, args.join(" ") + "\\n");
const [a, b] = args;
if (a === "label") process.stdout.write("[]");
else if (a === "api") process.stdout.write("[[]]");
else if (a === "project" && b === "list") process.stdout.write('{"projects":[]}');
else process.exit(9);
`,
    );
    writeFileSync(
      join(dir, "gh"),
      `#!/bin/sh\nexec '${process.execPath}' '${join(dir, "stub.js")}' "$@"\n`,
    );
    chmodSync(join(dir, "gh"), 0o755);
    const cli = (...args) => {
      const log = join(mkdtempSync(join(dir, "run-")), "calls.log");
      const result = spawnSync(
        process.execPath,
        [join(root, "packages/config/bin/github-setup.mjs"), ...args],
        {
          encoding: "utf8",
          env: {
            PATH: dir,
            STUB_LOG: log,
            GH_TOKEN: "",
            GH_CONFIG_DIR: dir,
            GH_PROMPT_DISABLED: "1",
          },
        },
      );
      const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
      return { ...result, calls };
    };

    test("--dry-run prints the plan and only reads", () => {
      const result = cli("--dry-run", "--repo", "example/does-not-exist");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("would create label type:feature");
      expect(result.stdout).toContain("would create project HEAT LMS");
      expect(result.calls.map((call) => call.split(" ").slice(0, 2).join(" "))).toEqual([
        "label list",
        "api --paginate",
        "project list",
      ]);
    });

    test("exits non-zero with a message when gh fails", () => {
      const result = cli("--repo", "example/does-not-exist");
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("github:setup failed");
      expect(result.calls.at(-1)).toMatch(/^project create /);
    });

    test("exits non-zero on bad flags without calling gh", () => {
      for (const args of [["--nope"], ["--repo", "../.."], ["--owner", "x y"]]) {
        const result = cli(...args);
        expect(result.status).toBe(1);
        expect(result.calls).toEqual([]);
      }
    });
  });
});

describe("issue forms and the pull request template", () => {
  const forms = ["feature", "bug", "spike", "chore"];
  const form = (type) =>
    parse(readFileSync(join(root, `.github/ISSUE_TEMPLATE/${type}.yml`), "utf8"));
  const required = [
    /^Context/,
    /^Acceptance criteria$/,
    /^Out of scope$/,
    /^Dependencies$/,
    /^Test plan$/,
    /^Security notes$/,
    /^Definition of done$/,
  ];

  test.each(forms)("%s form parses and has every section", (type) => {
    const { name, description, body } = form(type);
    expect(name).toBeTruthy();
    expect(description).toBeTruthy();
    const fields = body.filter((item) => item.type !== "markdown");
    const sectionLabels = fields.map((item) => item.attributes.label);
    expect(required.map((pattern) => sectionLabels.filter((l) => pattern.test(l)).length)).toEqual(
      required.map(() => 1),
    );
    expect(sectionLabels).toHaveLength(required.length);
    const ids = fields.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("the bug form warns against pasting secrets or personal data", () => {
    const [first] = form("bug").body;
    expect(first.type).toBe("markdown");
    expect(first.attributes.value).toMatch(/Do not paste .*personal data/);
  });

  test.each(forms)("%s form applies existing, managed labels", (type) => {
    const applied = form(type).labels;
    expect(applied).toEqual([`type:${type}`, "needs-refinement"]);
    expect(labels.map((l) => l.name)).toEqual(expect.arrayContaining(applied));
  });

  test.each(forms)("%s form asks for Given, When, Then criteria and a checklist", (type) => {
    const { body } = form(type);
    const criteria = body.find((item) => item.id === "acceptance-criteria");
    expect(criteria.attributes.description).toMatch(/Given, When, Then/);
    expect(criteria.validations.required).toBe(true);
    const done = body.find((item) => item.id === "definition-of-done");
    expect(done.type).toBe("checkboxes");
    expect(done.attributes.options.length).toBeGreaterThan(0);
  });

  test("the pull request template has every section", () => {
    const text = readFileSync(join(root, ".github/pull_request_template.md"), "utf8");
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    expect(headings).toEqual([
      "Summary",
      "Linked issue",
      "Test evidence",
      "Screenshots",
      "Security notes",
      "Checklist",
    ]);
    expect(text).toMatch(/^Closes #$/m);
    expect(text).toMatch(/^- \[ \] /m);
  });
});
