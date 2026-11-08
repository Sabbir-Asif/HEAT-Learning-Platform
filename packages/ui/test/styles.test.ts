import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const css = readFileSync(join(import.meta.dirname, "../src/styles.css"), "utf8");

function variables(selector: string): string[] {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  return [...block.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1] ?? "").sort();
}

test("the light and dark token sets define the same variables", () => {
  const light = variables(":root");
  expect(light).toEqual(expect.arrayContaining(["--background", "--foreground", "--primary"]));
  expect(variables("\\.dark")).toEqual(light);
});
