import { describe, expect, test } from "vitest";
import { runCli } from "../../src/cli/run-cli";
import { RecoveryError } from "../../src/cli/recover-super-admin.service";

const harness = (
  recover: () => Promise<{ email: string; temporaryPassword: string; lockoutCleared?: boolean }>,
) => {
  const out: string[] = [];
  const err: string[] = [];
  const run = (argv: string[]) =>
    runCli(
      argv,
      { recover: async () => ({ lockoutCleared: true, ...(await recover()) }) },
      { out: (text) => out.push(text), err: (text) => err.push(text) },
      "box",
    );
  return { out, err, run };
};

describe("runCli", () => {
  test("prints the temporary password once on stdout and exits zero", async () => {
    const { out, err, run } = harness(async () => ({
      email: "root@example.test",
      temporaryPassword: "Temp-Secret-123",
    }));

    expect(await run(["recover-super-admin"])).toBe(0);

    expect(out.join("")).toContain("root@example.test");
    expect(out.join("").match(/Temp-Secret-123/g)).toHaveLength(1);
    expect(err.join("")).not.toContain("Temp-Secret-123");
  });

  test("a refusal exits non-zero with the message on stderr and nothing on stdout", async () => {
    const { out, err, run } = harness(async () => {
      throw new RecoveryError("No super admin exists");
    });

    expect(await run(["recover-super-admin"])).toBe(1);

    expect(err.join("")).toContain("No super admin exists");
    expect(out.join("")).toBe("");
  });

  test("an unexpected failure exits non-zero without leaking its message", async () => {
    const { err, run } = harness(async () => {
      throw new Error("connection string postgres://secret");
    });

    expect(await run(["recover-super-admin"])).toBe(1);

    expect(err.join("")).not.toContain("secret");
  });

  test("bad arguments exit with code 2", async () => {
    const { err, run } = harness(async () => ({ email: "x", temporaryPassword: "y" }));

    expect(await run(["nope"])).toBe(2);
    expect(err.join("")).toContain("Usage:");
  });

  test("warns on stderr when the lockout could not be cleared, and still prints the password", async () => {
    const { out, err, run } = harness(async () => ({
      email: "root@example.test",
      temporaryPassword: "Temp-Secret-123",
      lockoutCleared: false,
    }));

    expect(await run(["recover-super-admin"])).toBe(0);

    expect(out.join("")).toContain("Temp-Secret-123");
    expect(err.join("")).toContain("lockout");
    expect(err.join("")).not.toContain("Temp-Secret-123");
  });
});
