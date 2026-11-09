import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  checkInventory,
  contrastRows,
  failingRows,
  validateTokens,
} from "../src/design-checks.mjs";

const designDir = resolve(import.meta.dirname, "../../../docs/design");
const readJson = (name) => JSON.parse(readFileSync(resolve(designDir, name), "utf8"));
const exportFiles = () => {
  try {
    return readdirSync(resolve(designDir, "exports"));
  } catch {
    return [];
  }
};

describe("docs/design/tokens.json", () => {
  const tokens = readJson("tokens.json");

  test("has every role, scale and font entry with light and dark in step", () => {
    expect(validateTokens(tokens)).toEqual([]);
  });

  test("every declared pair meets its contrast requirement in both themes", () => {
    const failing = failingRows(contrastRows(tokens)).map(
      (row) =>
        `${row.theme} ${row.foreground} on ${row.background}: ${row.ratio.toFixed(2)} of ${row.required}`,
    );
    expect(failing).toEqual([]);
  });
});

describe("docs/design/inventory.json", () => {
  test("every frame has an export, every export has a frame, and every overlay is a drawer", () => {
    expect(checkInventory(readJson("inventory.json"), exportFiles())).toEqual([]);
  });
});
