#!/usr/bin/env node
import { resolve } from "node:path";
import { changedMigrationFiles } from "../src/migrations.mjs";

const [command, base] = process.argv.slice(2);

if (command !== "immutable" || !base) {
  console.error("Usage: migrations.mjs immutable <base-ref>");
  process.exit(1);
}

let changed;
try {
  changed = changedMigrationFiles({ cwd: resolve(process.cwd()), base });
} catch (error) {
  console.error(`Could not compare against ${base}: ${error.message}`);
  process.exit(1);
}

if (changed.length) {
  console.error(
    [
      `Migrations that exist on ${base} must not change. Add a new migration instead.`,
      ...changed.map(({ status, path }) => `  - ${status}: ${path}`),
    ].join("\n"),
  );
  process.exit(1);
}
console.log(`Migrations from ${base} are unchanged.`);
