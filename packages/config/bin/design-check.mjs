#!/usr/bin/env node
import { resolve } from "node:path";
import { designReport } from "../src/design-report.mjs";

const root = resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dir = resolve(option("--design-dir") ?? resolve(root, "docs/design"));

const report = designReport(dir, { structure: !args.includes("--no-structure") });
(report.ok ? console.log : console.error)(report.output);
process.exit(report.ok ? 0 : 1);
