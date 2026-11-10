import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("builds a standalone server with the React Compiler", () => {
  expect(nextConfig.output).toBe("standalone");
  expect(nextConfig.reactCompiler).toBe(true);
});

test("sends X-Robots-Tag noindex on every path, including assets and the API", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  expect(rules[0]?.source).toBe("/:path*");
  expect(rules[0]?.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex" }]);
});

test("keeps the invitation token out of the Referer header", async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((entry) => entry.source === "/accept-invite/:token*");
  expect(rule?.headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
});
