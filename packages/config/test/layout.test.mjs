import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".next", ".turbo", "coverage"].includes(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const members = ["apps", "packages"].flatMap((group) =>
  readdirSync(join(root, group)).map((name) => join(root, group, name)),
);

test("tests live in each package's test/ directory, never in src/", () => {
  const misplaced = members
    .flatMap((member) => [...walk(member)])
    .filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))
    .map((file) => relative(root, file))
    .filter((file) => !/^(apps|packages)\/[^/]+\/test\//.test(file));
  expect(misplaced).toEqual([]);
});

test("every app and package has a test/ directory", () => {
  const missing = members
    .filter((member) => !statSync(join(member, "test"), { throwIfNoEntry: false })?.isDirectory())
    .map((member) => relative(root, member));
  expect(missing).toEqual([]);
});
