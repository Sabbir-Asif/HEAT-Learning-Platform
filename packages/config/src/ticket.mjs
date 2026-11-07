// The GitHub rules of the /implement-issue skill (plan section 12): whether a ticket may start,
// its branch name and base, the append-only refinement and the card moves. The skill calls these
// through `pnpm ticket` so the rules live in tested code, not in the skill's prose.
export const defaultRepo = "Sabbir-Asif/HEAT-Learning-Platform";
export const projectTitle = "HEAT LMS";
export const approvalMarker = "<!-- implement-issue:plan-approved -->";

const startStatuses = ["Ready", "Refining"];
// A ticket already under way is resumed from its branch rather than started again.
const resumeStatuses = ["In progress", "In review"];
// Author associations GitHub gives people with access to the repository. Anything else is an
// outsider whose text never reaches the agent (plan section 14).
const collaborators = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
const prefixes = { feature: "feat", bug: "fix", chore: "chore", docs: "docs", spike: "spike" };
const stopWords = new Set(["a", "an", "and", "the", "with", "for", "of", "to", "in", "on"]);
const maxSlugWords = 4;
const maxSlugLength = 40;

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

/** Lower-case words of the title without filler, joined by hyphens; "issue" when nothing is left. */
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

/** True when the pull request body uses a GitHub closing keyword on issue `number`. */
export function closesIssue(body, number) {
  const keyword = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
  return [...(body ?? "").matchAll(keyword)].some((match) => Number(match[1]) === number);
}

const json = (gh, args) => JSON.parse(gh(args));
const login = (author) => author?.login ?? "ghost";

function readIssue(gh, repo, number) {
  const [owner, name] = repo.split("/");
  const result = json(gh, [
    "api",
    "graphql",
    "-f",
    `query=${issueQuery}`,
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

/**
 * The branch for this issue: an existing `<type>/<N>-…` branch if there is one, otherwise a new
 * name from the type label and title. The base is the epic's `epic/<code>-…` branch on origin
 * when it exists, otherwise main.
 */
export function branchFor({ number, title, type, epic }, heads, localBranches = []) {
  const existing = new RegExp(`^(?:${Object.values(prefixes).join("|")})/${number}-`);
  const name =
    localBranches.find((branch) => existing.test(branch)) ??
    heads.find((branch) => existing.test(branch)) ??
    `${prefixes[type]}/${number}-${slugify(title)}`;
  const code = epic?.title.match(/^(E\d+)\b/i)?.[1].toLowerCase();
  const base =
    (code && heads.find((head) => head === `epic/${code}` || head.startsWith(`epic/${code}-`))) ||
    "main";
  return {
    name,
    base,
    existsRemote: heads.includes(name),
    existsLocal: localBranches.includes(name),
  };
}

function checkBlockers(gh, repo, blockedBy) {
  const open = blockedBy.filter((blocker) => blocker.state !== "CLOSED");
  // Pull requests into an epic branch do not close issues, so a blocker merged there is still
  // open on GitHub. Its closing pull request is what shows the work is in.
  const merged = open.length
    ? json(gh, [
        "pr",
        "list",
        "--repo",
        repo,
        "--state",
        "merged",
        "--limit",
        "200",
        "--json",
        "number,body,baseRefName",
      ]).filter((pr) => pr.baseRefName.startsWith("epic/"))
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
    "number,state,url",
  ]);
  return pr ? { number: pr.number, state: pr.state, url: pr.url } : null;
}

/**
 * Loads an issue with everything stage 1 needs and decides whether it may start.
 * `gh(args)` runs the GitHub CLI and returns stdout; this function only reads. `refusals` is empty
 * when the ticket may start. Comments from outside the repository's collaborators are dropped.
 */
export function loadTicket({ gh, repo, number, localBranches = [] }) {
  const issue = readIssue(gh, repo, number);
  const labels = issue.labels.nodes.map((label) => label.name);
  const types = labels.filter((label) => label.startsWith("type:")).map((label) => label.slice(5));
  const type = types.find((name) => name in prefixes) ?? null;
  const item = projectItemOf(issue);
  const epic = issue.parent ? { number: issue.parent.number, title: issue.parent.title } : null;
  const blockers = checkBlockers(gh, repo, issue.blockedBy.nodes);
  const comments = issue.comments.nodes
    .filter((comment) => collaborators.has(comment.authorAssociation))
    .map((comment) => ({
      author: login(comment.author),
      association: comment.authorAssociation,
      createdAt: comment.createdAt,
      body: comment.body,
    }));

  const branch =
    type && !types.includes("epic")
      ? branchFor({ number, title: issue.title, type, epic }, remoteHeads(gh, repo), localBranches)
      : null;
  const branchExists = Boolean(branch && (branch.existsLocal || branch.existsRemote));
  const resuming = branchExists && resumeStatuses.includes(item?.status);

  const refusals = [];
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
    needsApproval: item?.size === "L" || labels.includes("security"),
    planApproved: comments.some((comment) => comment.body.includes(approvalMarker)),
    refusals,
    projectItem: item ? { projectId: item.projectId, itemId: item.itemId } : null,
  };
}
