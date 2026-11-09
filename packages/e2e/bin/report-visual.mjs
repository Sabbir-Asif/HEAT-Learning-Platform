import { appendFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const results = resolve(import.meta.dirname, "../test-results");

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

export function changedScreens(files) {
  const found = new Map();
  for (const file of files) {
    const match = /([^/\\]+)-(actual|expected|diff)\.png$/.exec(file);
    if (!match) continue;
    const kinds = found.get(match[1]) ?? new Set();
    kinds.add(match[2]);
    found.set(match[1], kinds);
  }
  return [...found]
    .map(([name, kinds]) => ({ name, missingBaseline: !kinds.has("expected") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function report(files, outcome) {
  const screens = changedScreens(files);
  const lines = [];
  if (screens.length > 0) {
    const names = screens.map(({ name, missingBaseline }) =>
      missingBaseline ? `${name} (no baseline)` : name,
    );
    lines.push(
      `::warning title=Visual changes::${screens.length} screen(s) differ from the baseline: ${names.join(", ")}`,
    );
  } else if (outcome !== "success") {
    lines.push(
      "::warning title=Screenshot run did not finish::The screenshot suite failed before comparing screens. Check the job log.",
    );
  }
  const summary = [
    "## Screenshot comparison",
    "",
    screens.length > 0
      ? screens
          .map(({ name, missingBaseline }) => `- ${name}${missingBaseline ? " (no baseline)" : ""}`)
          .join("\n")
      : outcome === "success"
        ? "No visual changes."
        : "The suite failed before comparing screens.",
    "",
    "Actual, expected and diff images are in the `screenshot-diffs` artifact. This check never blocks a merge.",
    "",
  ].join("\n");
  return { annotations: lines, summary };
}

if (process.argv[1] === import.meta.filename) {
  const files = existsSync(results) ? [...walk(results)] : [];
  const { annotations, summary } = report(files, process.env.RUN_OUTCOME ?? "success");
  for (const line of annotations) console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  else console.log(summary);
}
