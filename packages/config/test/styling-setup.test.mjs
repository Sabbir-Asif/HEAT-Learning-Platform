import { ESLint } from "eslint";
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

describe("the Tailwind rules are active under each package's own eslint config", () => {
  for (const directory of packages.slice(1)) {
    test(directory, async () => {
      const cwd = resolve(root, directory);
      const eslint = new ESLint({
        cwd,
        overrideConfigFile: resolve(cwd, "eslint.config.mjs"),
      });
      const [result] = await eslint.lintText('export const a = <div className="p-2 p-4" />;\n', {
        filePath: resolve(cwd, "src/probe.tsx"),
      });
      expect(result.messages.map((message) => message.ruleId)).toContain(
        "better-tailwindcss/no-conflicting-classes",
      );
    });
  }
});
