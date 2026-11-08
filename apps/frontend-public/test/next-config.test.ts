import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("builds a standalone server with the React Compiler", () => {
  expect(nextConfig.output).toBe("standalone");
  expect(nextConfig.reactCompiler).toBe(true);
});

test("compiles the shared packages, including the catalogs", () => {
  expect(nextConfig.transpilePackages).toEqual(
    expect.arrayContaining(["@heat/ui", "@heat/i18n", "@heat/api-client", "@heat/contracts"]),
  );
});

test("wires the next-intl request config", () => {
  const aliases = nextConfig.turbopack?.resolveAlias ?? {};
  expect(JSON.stringify(aliases)).toContain("src/i18n/request.ts");
});
