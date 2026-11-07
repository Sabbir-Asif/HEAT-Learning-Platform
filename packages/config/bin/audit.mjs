#!/usr/bin/env node
// Fails on high or critical advisories that are not in .github/audit-ignore.json.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateAudit } from "../src/audit.mjs";

const root = resolve(import.meta.dirname, "../../..");
const ignores = JSON.parse(readFileSync(resolve(root, ".github/audit-ignore.json"), "utf8"));

// pnpm exits non-zero when it finds anything, so the verdict comes from the report, not the exit code.
const audit = spawnSync("pnpm", ["audit", "--json"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024, // the report lists every dependency path in every workspace
});
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error(
    `pnpm audit gave no readable report (${audit.error?.message ?? `exit ${audit.status}`}).\n${audit.stderr}`,
  );
  process.exit(1);
}

const failures = evaluateAudit(report, ignores, new Date());
if (failures.length) {
  console.error(["Dependency audit failed:", ...failures.map((f) => `  - ${f}`)].join("\n"));
  process.exit(1);
}
console.log(`Dependency audit passed: ${JSON.stringify(report.metadata?.vulnerabilities ?? {})}`);
