import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const entries = readFileSync(resolve(root, ".github/CODEOWNERS"), "utf8")
  .split("\n")
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => line.split(/\s+/));

test.each([
  "/.github/",
  "/.claude/settings.json",
  "/packages/config/src/hooks/",
  "/packages/config/bin/hook.mjs",
  "/packages/config/bin/verify.mjs",
  "/packages/config/src/verify.mjs",
  "/packages/config/bin/audit.mjs",
  "/packages/config/src/audit.mjs",
  "/packages/config/bin/github-setup.mjs",
  "/packages/config/src/github-setup.mjs",
])("the owner reviews changes to %s", (path) => {
  expect(entries).toContainEqual([path, "@Sabbir-Asif"]);
});
