import { expect, test } from "vitest";
import nextConfig from "../next.config";

test("builds a standalone server with the React Compiler", () => {
  expect(nextConfig.output).toBe("standalone");
  expect(nextConfig.reactCompiler).toBe(true);
});
