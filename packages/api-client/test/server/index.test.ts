import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const root = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("the server fetcher starts with the server-only import, so a Client Component cannot bundle it", () => {
  const firstStatement = read("src/server/server-fetch.ts")
    .split("\n")
    .find((line) => line.trim() !== "");
  expect(firstStatement).toBe('import "server-only";');
});

test("the generated server functions can only reach the API through the server fetcher", () => {
  expect(read("src/generated/server/endpoints.ts")).toContain("../../server/server-fetch");
});

test("the server entry is a subpath export and the root entry never reaches it", () => {
  const packageJson = JSON.parse(read("package.json")) as { exports: Record<string, string> };
  expect(packageJson.exports["./server"]).toBe("./src/server/index.ts");
  expect(read("src/index.ts")).not.toMatch(/server/);
  expect(read("src/mocks.ts")).not.toMatch(/server/);
});
