#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { contrastReport } from "../src/design-report.mjs";

const root = resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const file = resolve(option("--tokens") ?? resolve(root, "docs/design/tokens.json"));

let tokens;
try {
  tokens = JSON.parse(readFileSync(file, "utf8"));
} catch (error) {
  console.error(`Cannot read ${file}: ${error.message}`);
  process.exit(1);
}

const report = contrastReport(tokens, { structure: !args.includes("--no-structure") });
(report.ok ? console.log : console.error)(report.output);
process.exit(report.ok ? 0 : 1);
