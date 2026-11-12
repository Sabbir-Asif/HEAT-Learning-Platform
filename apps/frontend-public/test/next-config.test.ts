import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("builds a standalone server with the React Compiler", () => {
  expect(nextConfig.output).toBe("standalone");
  expect(nextConfig.reactCompiler).toBe(true);
});

test("keeps the verification token out of the referrer", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];

  expect(rules).toContainEqual({
    source: "/verify-email/:token*",
    headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  });
});

test("enables the use cache directive for tagged public data", () => {
  expect(nextConfig.experimental?.useCache).toBe(true);
});
