import { describe, expect, test } from "vitest";
import { parseArguments } from "../../src/cli/cli-arguments";

describe("parseArguments", () => {
  test("accepts the bare command", () => {
    expect(parseArguments(["recover-super-admin"])).toEqual({ ok: true, email: undefined });
  });

  test.each([
    [["recover-super-admin", "--email", "root@example.test"]],
    [["recover-super-admin", "--email=root@example.test"]],
  ])("reads the email flag from %j", (argv) => {
    expect(parseArguments(argv)).toEqual({ ok: true, email: "root@example.test" });
  });

  test.each([
    [[]],
    [["other"]],
    [["recover-super-admin", "--email"]],
    [["recover-super-admin", "--email", "   "]],
    [["recover-super-admin", "--password", "x"]],
    [["recover-super-admin", "extra"]],
  ])("rejects %j with a usage message", (argv) => {
    const result = parseArguments(argv);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.message).toContain("Usage:");
  });
});
