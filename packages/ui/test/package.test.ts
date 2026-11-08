import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const root = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string>;
};

test("exports the component entry and the stylesheet the apps import", () => {
  expect(manifest.exports["."]).toBe("./src/index.ts");
  expect(manifest.exports["./styles.css"]).toBe("./src/styles.css");
  expect(existsSync(join(root, manifest.exports["./styles.css"] ?? "missing"))).toBe(true);
});
