import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const configs = {};
const configFor = async (preset) => {
  configs[preset] ??= (await import(`../eslint/${preset}.js`)).default;
  return configs[preset];
};

const run = async (preset, code, filePath, fix = false) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: await configFor(preset),
    fix,
  });
  const [result] = await eslint.lintText(code, { filePath });
  return result;
};

const lint = async (preset, code, filePath) => (await run(preset, code, filePath)).messages;

const appFile = "src/app/page.tsx";
const uiFile = "src/button/button.tsx";
const markup = (classes) => `export const a = <div className="${classes}" />;\n`;

describe("class conflicts and order are errors", () => {
  for (const [preset, file] of [
    ["app", appFile],
    ["ui", uiFile],
  ]) {
    test(`${preset} reports conflicting classes as errors`, async () => {
      for (const classes of ["p-2 p-4", "flex grid"]) {
        const messages = await lint(preset, markup(classes), file);
        const conflict = messages.find(
          (message) => message.ruleId === "better-tailwindcss/no-conflicting-classes",
        );
        expect(conflict?.severity).toBe(2);
      }
    });

    test(`${preset} reports misordered classes as errors and fixes them`, async () => {
      const messages = await lint(preset, markup("p-4 flex"), file);
      const order = messages.find(
        (message) => message.ruleId === "better-tailwindcss/enforce-consistent-class-order",
      );
      expect(order?.severity).toBe(2);
      const fixed = await run(preset, markup("p-4 flex"), file, true);
      expect(fixed.output).toBe(markup("flex p-4"));
    });

    test(`${preset} accepts ordered, non-conflicting classes`, async () => {
      expect(await lint(preset, markup("flex gap-4 p-4"), file)).toEqual([]);
    });
  }
});
