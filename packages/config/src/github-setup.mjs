// Idempotent setup of the repository labels, milestones and the GitHub Project (plan section 11).
// It only creates things, or updates a label's colour and description in place. It never deletes or
// renames anything and never touches issues or project items; anything else found is left alone.
import { parseArgs } from "node:util";

export const defaultRepo = "Sabbir-Asif/HEAT-Learning-Platform";
export const defaultProjectTitle = "HEAT LMS";

// One list feeds both the `area:*` labels and the Project's Area options, so they cannot drift.
export const areas = [
  "api",
  "frontend-public",
  "frontend-internal",
  "ui",
  "worker",
  "infra",
  "design",
  "docs",
];

// Colours and descriptions match what the initial import created, so a first run changes nothing.
export const labels = [
  ...["feature", "chore", "spike", "docs", "bug"].map((type) => ({
    name: `type:${type}`,
    color: "1d76db",
    description: `${type[0].toUpperCase()}${type.slice(1)} work`,
  })),
  { name: "type:epic", color: "5319e7", description: "Epic work" },
  ...areas.map((area) => ({ name: `area:${area}`, color: "c5def5", description: `Area: ${area}` })),
  {
    name: "security",
    color: "b60205",
    description: "Touches auth, permissions, uploads, personal data or secrets",
  },
  { name: "critical-path", color: "d93f0b", description: "P0: blocks a phase exit" },
  {
    name: "needs-refinement",
    color: "fbca04",
    description: "Needs the refinement stage before work starts",
  },
  { name: "ready", color: "0e8a16", description: "Refined and ready to start" },
  { name: "blocked", color: "000000", description: "Waiting on another issue" },
  { name: "in-progress", color: "0052cc", description: "Being worked on" },
];

export const milestones = [
  "P0 · Foundation",
  "P1 · Video delivery spike",
  "P2 · Identity, enrollment and approval",
  "P3 · Authoring and video pipeline",
  "P4 · Learning and assessment",
  "P5 · Completion, content and insights",
  "P6 · Hardening",
  "P7 · Pilot and launch",
  "Backlog · Later (v1.1)",
];

const range = (prefix, from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);

// A new project already has a Status field with GitHub's own options (Todo, In Progress, Done).
// The managed options are added next to them; options are never removed.
export const projectFields = [
  {
    name: "Status",
    options: ["Backlog", "Refining", "Ready", "In progress", "In review", "Done"],
  },
  { name: "Epic", options: range("E", 0, 16) },
  { name: "Phase", options: [...range("P", 0, 7), "Backlog"] },
  { name: "Priority", options: ["P0", "P1", "P2"] },
  { name: "Size", options: ["S", "M", "L"] },
  { name: "Area", options: areas },
];

const singleSelect = "ProjectV2SingleSelectField";
const projectListLimit = 100;
// GitHub logins are letters, digits and single hyphens; repository names also allow . and _.
const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const repoNamePattern = /^[\w.-]{1,100}$/;

function checkTarget(repo, owner) {
  const [repoOwner, name, ...rest] = repo.split("/");
  if (rest.length || !ownerPattern.test(repoOwner ?? "") || !repoNamePattern.test(name ?? "")) {
    throw new Error(`Invalid --repo "${repo}"`);
  }
  if (name === "." || name === "..") throw new Error(`Invalid --repo "${repo}"`);
  if (!ownerPattern.test(owner)) throw new Error(`Invalid --owner "${owner}"`);
}

/** Parses the command line; throws on an unknown flag or a malformed repository. */
export function parseCli(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": { type: "boolean", default: false },
      repo: { type: "string", default: defaultRepo },
      owner: { type: "string" },
      project: { type: "string", default: defaultProjectTitle },
    },
  });
  const owner = values.owner ?? values.repo.split("/")[0];
  checkTarget(values.repo, owner);
  return {
    dryRun: values["dry-run"],
    repo: values.repo,
    owner,
    projectTitle: values.project,
  };
}

/**
 * Brings the repository and project in line with the lists above.
 * `gh(args, input)` runs the GitHub CLI and returns stdout. Returns the number of writes made (or
 * planned, in a dry run) and the problems that need a person.
 */
export function setup({ gh, repo, owner, projectTitle, dryRun = false, log = console.log }) {
  checkTarget(repo, owner);
  let changes = 0;
  const problems = [];
  const json = (args) => JSON.parse(gh(args));
  // Every write goes through here, so a dry run cannot make one by accident.
  const write = (description, args, input) => {
    changes += 1;
    log(`${dryRun ? "would " : ""}${description}`);
    return dryRun ? undefined : gh(args, input);
  };

  const existingLabels = new Map(
    json([
      "label",
      "list",
      "--repo",
      repo,
      "--limit",
      "500",
      "--json",
      "name,color,description",
    ]).map((label) => [label.name.toLowerCase(), label]),
  );
  for (const want of labels) {
    const have = existingLabels.get(want.name.toLowerCase());
    const flags = ["--repo", repo, "--color", want.color, "--description", want.description];
    if (!have) {
      write(`create label ${want.name}`, ["label", "create", want.name, ...flags]);
    } else if (
      have.color.toLowerCase() !== want.color ||
      (have.description ?? "") !== want.description
    ) {
      write(`update label ${have.name}`, ["label", "edit", have.name, ...flags]);
    }
  }

  const existingMilestones = new Set(
    json(["api", "--paginate", "--slurp", `repos/${repo}/milestones?state=all&per_page=100`])
      .flat()
      .map((milestone) => milestone.title),
  );
  for (const title of milestones.filter((title) => !existingMilestones.has(title))) {
    write(`create milestone ${title}`, [
      "api",
      "--method",
      "POST",
      `repos/${repo}/milestones`,
      "-f",
      `title=${title}`,
    ]);
  }

  // Closed projects are listed too, so a closed one is reported instead of duplicated.
  const { projects } = json([
    "project",
    "list",
    "--owner",
    owner,
    "--closed",
    "--limit",
    String(projectListLimit),
    "--format",
    "json",
  ]);
  const named = projects.filter((project) => project.title === projectTitle);
  let number = named.find((project) => !project.closed)?.number;
  if (number === undefined && named.length) {
    throw new Error(`Project "${projectTitle}" is closed; reopen it or pass another --project`);
  }
  if (number === undefined) {
    if (projects.length >= projectListLimit) {
      throw new Error(
        `Owner has ${projectListLimit}+ projects; cannot tell if "${projectTitle}" exists`,
      );
    }
    const created = write(`create project ${projectTitle}`, [
      "project",
      "create",
      "--owner",
      owner,
      "--title",
      projectTitle,
      "--format",
      "json",
    ]);
    number = created && JSON.parse(created).number;
  }
  // In a dry run with no project yet, nothing exists to compare against.
  const existingFields =
    number === undefined
      ? []
      : json([
          "project",
          "field-list",
          String(number),
          "--owner",
          owner,
          "--limit",
          "100",
          "--format",
          "json",
        ]).fields;
  for (const want of projectFields) {
    const have = existingFields.find((field) => field.name === want.name);
    if (!have) {
      write(`create field ${want.name}`, [
        "project",
        "field-create",
        String(number),
        "--owner",
        owner,
        "--name",
        want.name,
        "--data-type",
        "SINGLE_SELECT",
        "--single-select-options",
        want.options.join(","),
      ]);
      continue;
    }
    if (have.type !== singleSelect) {
      problems.push(`Field ${want.name} is ${have.type}, expected a single select; left unchanged`);
      continue;
    }
    const present = new Set(have.options.map((option) => option.name));
    const missing = want.options.filter((option) => !present.has(option));
    for (const extra of [...present].filter((option) => !want.options.includes(option))) {
      log(`keep extra option ${extra} on field ${want.name}`);
    }
    if (missing.length) addOptions({ gh, write, log, dryRun, field: have, missing });
  }

  log(`${dryRun ? "Planned" : "Made"} ${changes} change${changes === 1 ? "" : "s"}.`);
  return { changes, problems };
}

const optionQuery =
  "query($id: ID!) { node(id: $id) { ... on ProjectV2SingleSelectField { options { id name color description } } } }";
const optionMutation =
  "mutation($input: UpdateProjectV2FieldInput!) { updateProjectV2Field(input: $input) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }";

const optionKey = (options, keys) => JSON.stringify(options.map((o) => keys.map((key) => o[key])));

// The API only replaces a field's whole option list, so this is the one write that could lose data
// (an option dropped, or ids regenerated so items lose their value). It is guarded three ways:
// the options are read twice and nothing is written if they changed; the list is printed first so
// it can be restored; and the field is read back and the script fails loudly if any option id or
// name is gone. The existing options go back with their ids, and the new ones are appended.
function addOptions({ gh, write, log, dryRun, field, missing }) {
  const description = `add option${missing.length === 1 ? "" : "s"} ${missing.join(", ")} to field ${field.name}`;
  if (dryRun) return write(description);
  const read = () =>
    JSON.parse(gh(["api", "graphql", "-f", `query=${optionQuery}`, "-f", `id=${field.id}`])).data
      .node.options;
  const before = read();
  if (optionKey(before, ["id", "name"]) !== optionKey(field.options, ["id", "name"])) {
    throw new Error(`Options of field ${field.name} changed while reading; nothing was written`);
  }
  log(
    `backup of field ${field.name} options (for updateProjectV2Field): ${JSON.stringify(before)}`,
  );
  // Read again as late as possible, so an option added in the web UI in between is not dropped.
  const latest = read();
  const all = ["id", "name", "color", "description"];
  if (optionKey(before, all) !== optionKey(latest, all)) {
    throw new Error(`Options of field ${field.name} changed before the write; nothing was written`);
  }
  const options = [...latest, ...missing.map((name) => ({ name, color: "GRAY", description: "" }))];
  const result = write(
    description,
    ["api", "graphql", "--input", "-"],
    JSON.stringify({
      query: optionMutation,
      variables: { input: { fieldId: field.id, singleSelectOptions: options } },
    }),
  );
  const after = read();
  const lost = before.filter(
    (old) => !after.some((now) => now.id === old.id && now.name === old.name),
  );
  const added = missing.filter((name) => !after.some((now) => now.name === name));
  if (lost.length || added.length) {
    throw new Error(
      `Field ${field.name} options changed unexpectedly after the write (lost: ${JSON.stringify(lost)}; not added: ${JSON.stringify(added)}). Restore from the backup line printed above`,
    );
  }
  return result;
}
