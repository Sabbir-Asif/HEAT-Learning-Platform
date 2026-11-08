import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const packages = [
  "packages/config",
  "packages/ui",
  "apps/frontend-public",
  "apps/frontend-internal",
];

describe("tailwindcss is resolvable from every linted package", () => {
  for (const directory of packages) {
    test(directory, () => {
      const requireFrom = createRequire(resolve(root, directory, "package.json"));
      expect(() => requireFrom.resolve("tailwindcss/package.json")).not.toThrow();
    });
  }
});
