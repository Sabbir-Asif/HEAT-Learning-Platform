import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { report } from "./budget.mjs";
import { resultsDir } from "./paths.mjs";

const file = join(resultsDir, "results.json");
const results = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
const { annotations, summary } = report(results, {
  outcome: process.env.RUN_OUTCOME ?? "success",
  artifactUrl: process.env.ARTIFACT_URL,
});
for (const line of annotations) console.log(line);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
else console.log(summary);
