import { parseArgs } from "node:util";
import { checkTarget } from "./github-setup.mjs";

export const defaultRepo = "Sabbir-Asif/HEAT-Learning-Platform";
export const projectTitle = "HEAT LMS";
export const approvalMarker = "<!-- implement-issue:plan-approved -->";
const markerPattern = /implement-issue:plan-approved/;

const startStatuses = ["Ready", "Refining"];
const resumeStatuses = ["In progress", "In review"];
export const collaborators = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const prefixes = { feature: "feat", bug: "fix", chore: "chore", docs: "docs", spike: "spike" };
const stopWords = new Set(["a", "an", "and", "the", "with", "for", "of", "to", "in", "on"]);
const maxSlugWords = 4;
const maxSlugLength = 40;
const safeBranch = /^(?:feat|fix|chore|docs|spike)\/\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeEpic = /^epic\/e\d+(?:-[a-z0-9]+)*$/;

const issueQuery = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number title url state body authorAssociation
      author { login }
      labels(first: 50) { nodes { name } }
      parent { number title }
      blockedBy(first: 50) { nodes { number title state } }
      subIssues(first: 100) { nodes { number title state } }
      comments(last: 100) { nodes { author { login } authorAssociation createdAt body } }
      projectItems(first: 20) {
        nodes {
          id
          project { id title }
          fieldValues(first: 30) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
        }
      }
    }
  }
}`;

export function slugify(title) {
  const words = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word && !stopWords.has(word))
    .slice(0, maxSlugWords);
  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > maxSlugLength) break;
    slug = next;
  }
  return slug || words[0]?.slice(0, maxSlugLength) || "issue";
}

export function closesIssue(body, number) {
  const keyword = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
  return [...(body ?? "").matchAll(keyword)].some((match) => Number(match[1]) === number);
}

const json = (gh, args) => JSON.parse(gh(args));
const login = (author) => author?.login ?? "ghost";

function queryIssue(gh, repo, number, query) {
  const [owner, name] = repo.split("/");
  const result = json(gh, [
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-F",
    `number=${number}`,
  ]);
  const issue = result.data?.repository?.issue;
  if (!issue) throw new Error(`Issue #${number} not found in ${repo}`);
  return issue;
}

function projectItemOf(issue) {
  const item = issue.projectItems.nodes.find((node) => node.project.title === projectTitle);
  if (!item) return null;
  const field = (name) =>
    item.fieldValues.nodes.find((value) => value.field?.name === name)?.name ?? null;
  return {
    projectId: item.project.id,
    itemId: item.id,
    status: field("Status"),
    size: field("Size"),
  };
}

function remoteHeads(gh, repo) {
  return gh(["api", `repos/${repo}/git/matching-refs/heads/`, "--paginate", "--jq", ".[].ref"])
    .split("\n")
    .filter(Boolean)
    .map((ref) => ref.replace(/^refs\/heads\//, ""));
}

function resolveBranch({ number, title, type, epic }, heads, localBranches) {
  const forIssue = new RegExp(`^(?:${Object.values(prefixes).join("|")})/${number}-`);
  const existing = [...localBranches, ...heads].filter((branch) => forIssue.test(branch));
  const unsafe = [...new Set(existing.filter((branch) => !safeBranch.test(branch)))];
  const code = epic?.title.match(/^(E\d+)\b/i)?.[1].toLowerCase();
  const epics = code
    ? heads.filter(
        (head) =>
          safeEpic.test(head) && (head === `epic/${code}` || head.startsWith(`epic/${code}-`)),
      )
    : [];
  const problems = [
    ...unsafe.map(
      (branch) =>
        `Branch "${branch}" for #${number} has an unsafe branch name; the owner renames or deletes it.`,
    ),
    ...(epics.length > 1
      ? [
          `#${number}'s epic has more than one epic branch (${epics.join(", ")}); the owner keeps one.`,
        ]
      : []),
  ];
  if (problems.length) return { branch: null, problems };
  const name = existing[0] ?? `${prefixes[type]}/${number}-${slugify(title)}`;
  return {
    branch: {
      name,
      base: epics[0] ?? "main",
      existsRemote: heads.includes(name),
      existsLocal: localBranches.includes(name),
    },
    problems,
  };
}

function checkBlockers(gh, repo, blockedBy, heads) {
  const open = blockedBy.filter((blocker) => blocker.state !== "CLOSED");
  const merged = open.length
    ? heads
        .filter((head) => safeEpic.test(head))
        .flatMap((head) =>
          json(gh, [
            "pr",
            "list",
            "--repo",
            repo,
            "--base",
            head,
            "--state",
            "merged",
            "--limit",
            "500",
            "--json",
            "number,body,baseRefName,isCrossRepository",
          ]),
        )
        .filter((pr) => !pr.isCrossRepository)
    : [];
  return blockedBy.map(({ number, title, state }) => {
    const closingPr =
      state === "CLOSED"
        ? null
        : (merged.find((pr) => closesIssue(pr.body, number))?.number ?? null);
    return { number, title, state, closingPr, done: state === "CLOSED" || closingPr !== null };
  });
}

function findPr(gh, repo, branch) {
  const [pr] = json(gh, [
    "pr",
    "list",
    "--repo",
    repo,
    "--head",
    branch,
    "--state",
    "all",
    "--json",
    "number,state,url,isCrossRepository",
  ]).filter((each) => !each.isCrossRepository);
  return pr ? { number: pr.number, state: pr.state, url: pr.url } : null;
}

export function loadTicket({ gh, repo, number, localBranches = [] }) {
  const issue = queryIssue(gh, repo, number, issueQuery);
  const labels = issue.labels.nodes.map((label) => label.name);
  const types = labels.filter((label) => label.startsWith("type:")).map((label) => label.slice(5));
  const type = types.find((name) => name in prefixes) ?? null;
  const item = projectItemOf(issue);
  const epic = issue.parent ? { number: issue.parent.number, title: issue.parent.title } : null;
  const heads = remoteHeads(gh, repo);
  const blockers = checkBlockers(gh, repo, issue.blockedBy.nodes, heads);
  const comments = issue.comments.nodes
    .filter((comment) => collaborators.has(comment.authorAssociation))
    .map((comment) => ({
      author: login(comment.author),
      association: comment.authorAssociation,
      createdAt: comment.createdAt,
      body: comment.body,
    }));

  const { branch, problems } =
    type && !types.includes("epic")
      ? resolveBranch({ number, title: issue.title, type, epic }, heads, localBranches)
      : { branch: null, problems: [] };
  const branchExists = Boolean(branch && (branch.existsLocal || branch.existsRemote));
  const resuming = branchExists && resumeStatuses.includes(item?.status);

  const refusals = [...problems];
  if (issue.state !== "OPEN") refusals.push(`#${number} is closed.`);
  if (!collaborators.has(issue.authorAssociation)) {
    refusals.push(
      `#${number} was opened by @${login(issue.author)}, who is not a repository collaborator.`,
    );
  }
  if (types.includes("epic")) {
    refusals.push(`#${number} is an epic; implement its sub-issues instead.`);
  } else if (!type) {
    refusals.push(`#${number} has no type: label, so the branch prefix is unknown.`);
  }
  if (!item) {
    refusals.push(`#${number} is not on the ${projectTitle} project board.`);
  } else if (resumeStatuses.includes(item.status) && !branchExists) {
    refusals.push(
      `Project status is "${item.status}" but no branch for #${number} exists, so there is nothing to resume.`,
    );
  } else if (!startStatuses.includes(item.status) && !resuming) {
    refusals.push(
      `Project status is "${item.status ?? "none"}"; it must be ${startStatuses.join(" or ")}.`,
    );
  }
  if (labels.includes("blocked")) refusals.push(`#${number} has the blocked label.`);
  for (const blocker of blockers.filter((each) => !each.done)) {
    refusals.push(
      `Blocked by #${blocker.number} (${blocker.title}), which is open with no merged closing pull request.`,
    );
  }

  return {
    number: issue.number,
    title: issue.title,
    url: issue.url,
    state: issue.state,
    author: login(issue.author),
    labels,
    body: issue.body,
    type,
    size: item?.size ?? null,
    status: item?.status ?? null,
    epic,
    blockers,
    subIssues: issue.subIssues.nodes.map(({ number: n, title, state }) => ({
      number: n,
      title,
      state,
    })),
    comments,
    hiddenComments: issue.comments.nodes.length - comments.length,
    branch,
    resuming,
    pr: branch ? findPr(gh, repo, branch.name) : null,
    needsApproval: item?.size === "L" || labels.includes("needs-approval"),
    planApproved: comments.some(
      (comment) => comment.association === "OWNER" && comment.body.includes(approvalMarker),
    ),
    refusals,
    projectItem: item ? { projectId: item.projectId, itemId: item.itemId } : null,
  };
}

export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

const readBody = (gh, repo, number) =>
  json(gh, ["api", `repos/${repo}/issues/${number}`]).body ?? "";

export function appendRefinement({ gh, repo, number, text, summary, date = today() }) {
  const addition = text.trim();
  if (!addition) throw new Error("Refinement text is empty");
  if (markerPattern.test(text) || markerPattern.test(summary ?? "")) {
    throw new Error("Refinement text must not carry the plan approval marker");
  }
  const original = readBody(gh, repo, number);
  const section = /^## Refined\s*$/m.test(original)
    ? `\n\n### Update ${date}\n\n${addition}\n`
    : `\n\n---\n\n## Refined\n\n${addition}\n`;
  const next = original + section;
  if (readBody(gh, repo, number) !== original) {
    throw new Error(
      `Issue #${number} body changed while the refinement was prepared; run it again.`,
    );
  }
  gh(["issue", "edit", String(number), "--repo", repo, "--body-file", "-"], next);
  const lf = (value) => value.replace(/\r\n/g, "\n");
  if (lf(readBody(gh, repo, number)) !== lf(next)) {
    throw new Error(
      `Issue #${number} body is not what was written; someone may have edited it. Check it by hand.`,
    );
  }
  const log = summary ?? 'appended to the "Refined" section; the original text is unchanged.';
  gh(
    ["issue", "comment", String(number), "--repo", repo, "--body-file", "-"],
    `Refinement log (${date}): ${log}`,
  );
  return { body: next };
}

const stages = {
  start: { status: "In progress", add: ["in-progress"], remove: ["needs-refinement", "ready"] },
  review: { status: "In review", add: [], remove: [] },
};

const cardQuery = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      labels(first: 50) { nodes { name } }
      projectItems(first: 20) {
        nodes {
          id
          project {
            id title
            field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
          }
        }
      }
    }
  }
}`;

export function moveCard({ gh, repo, number, stage }) {
  const want = stages[stage];
  if (!want) throw new Error(`Unknown stage "${stage}"; use ${Object.keys(stages).join(" or ")}`);
  const issue = queryIssue(gh, repo, number, cardQuery);
  const item = issue.projectItems.nodes.find((node) => node.project.title === projectTitle);
  if (!item) throw new Error(`#${number} is not on the ${projectTitle} project board`);
  const field = item.project.field;
  const option = field.options.find((each) => each.name === want.status);
  if (!option) throw new Error(`Status option "${want.status}" not found on ${projectTitle}`);

  const labels = issue.labels.nodes.map((label) => label.name);
  const add = want.add.filter((label) => !labels.includes(label));
  const remove = want.remove.filter((label) => labels.includes(label));
  gh([
    "project",
    "item-edit",
    "--id",
    item.id,
    "--project-id",
    item.project.id,
    "--field-id",
    field.id,
    "--single-select-option-id",
    option.id,
  ]);
  if (add.length || remove.length) {
    gh([
      "issue",
      "edit",
      String(number),
      "--repo",
      repo,
      ...(add.length ? ["--add-label", add.join(",")] : []),
      ...(remove.length ? ["--remove-label", remove.join(",")] : []),
    ]);
  }
}

export const usage = [
  "Usage: pnpm ticket load <N>",
  "       pnpm ticket refine <N> --file <path> [--summary <text>]",
  "       pnpm ticket move <N> start|review",
  "Options: --repo owner/name (default " + defaultRepo + ")",
].join("\n");

export function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      repo: { type: "string", default: defaultRepo },
      file: { type: "string" },
      summary: { type: "string" },
    },
  });
  const [command, numberText, stage, ...extra] = positionals;
  if (!["load", "refine", "move"].includes(command) || extra.length) throw new Error(usage);
  if (!/^[1-9]\d{0,8}$/.test(numberText ?? "")) {
    throw new Error(`Expected an issue number, got "${numberText ?? ""}"\n${usage}`);
  }
  checkTarget(values.repo, values.repo.split("/")[0]);
  const base = { command, number: Number(numberText), repo: values.repo };
  if (command === "move") {
    if (!(stage in stages) || values.file || values.summary) {
      throw new Error(`move takes start or review\n${usage}`);
    }
    return { ...base, stage };
  }
  if (stage || (command === "load" && (values.file || values.summary))) throw new Error(usage);
  if (command === "refine") {
    if (!values.file) throw new Error(`refine needs --file <path>\n${usage}`);
    return { ...base, file: values.file, summary: values.summary };
  }
  return base;
}
