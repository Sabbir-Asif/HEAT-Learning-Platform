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
const repoPattern = /^[\w.-]+\/[\w.-]+$/;

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
  if (!repoPattern.test(values.repo)) throw new Error(`Invalid --repo "${values.repo}"`);
  return {
    dryRun: values["dry-run"],
    repo: values.repo,
    owner: values.owner ?? values.repo.split("/")[0],
    projectTitle: values.project,
  };
}

/**
 * Brings the repository and project in line with the lists above.
 * `gh(args, input)` runs the GitHub CLI and returns stdout. Returns the number of writes made (or
 * planned, in a dry run) and the problems that need a person.
 */
export function setup({ gh, repo, owner, projectTitle, dryRun = false, log = console.log }) {
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

  const listed = json(["project", "list", "--owner", owner, "--limit", "100", "--format", "json"]);
  let number = listed.projects.find((project) => project.title === projectTitle)?.number;
  if (number === undefined) {
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
    if (missing.length) addOptions({ gh, write, dryRun, field: have, missing });
  }

  log(`${dryRun ? "Planned" : "Made"} ${changes} change${changes === 1 ? "" : "s"}.`);
  return { changes, problems };
}

// The API only replaces a field's whole option list. The existing options go back with their ids,
// so items keep their values, and the new ones are appended.
function addOptions({ gh, write, dryRun, field, missing }) {
  const description = `add option${missing.length === 1 ? "" : "s"} ${missing.join(", ")} to field ${field.name}`;
  if (dryRun) return write(description);
  const read = JSON.parse(
    gh([
      "api",
      "graphql",
      "-f",
      "query=query($id: ID!) { node(id: $id) { ... on ProjectV2SingleSelectField { options { id name color description } } } }",
      "-f",
      `id=${field.id}`,
    ]),
  );
  const options = [
    ...read.data.node.options,
    ...missing.map((name) => ({ name, color: "GRAY", description: "" })),
  ];
  return write(
    description,
    ["api", "graphql", "--input", "-"],
    JSON.stringify({
      query:
        "mutation($input: UpdateProjectV2FieldInput!) { updateProjectV2Field(input: $input) { projectV2Field { ... on ProjectV2SingleSelectField { id } } } }",
      variables: { input: { fieldId: field.id, singleSelectOptions: options } },
    }),
  );
}
