import { describe, expect, test } from "vitest";
import { executeCli } from "../../src/cli/execute-cli";

const collect = () => {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, output: { out: (t: string) => out.push(t), err: (t: string) => err.push(t) } };
};

const recoverer = {
  recover: async () => ({
    email: "root@example.test",
    temporaryPassword: "Temp-Secret-123",
    lockoutCleared: true,
  }),
};

describe("executeCli", () => {
  test("a failing close neither changes the exit code nor hides the printed password", async () => {
    const { out, err, output } = collect();

    const code = await executeCli({
      argv: ["recover-super-admin"],
      open: async () => ({
        recoverer,
        close: async () => {
          throw new Error("postgresql://user:secret@db/heat connection reset");
        },
      }),
      output,
      hostname: "box",
      environment: {},
    });

    expect(code).toBe(0);
    expect(out.join("")).toContain("Temp-Secret-123");
    expect(err.join("")).not.toContain("secret@db");
  });

  test("a bootstrap failure prints the configuration problem by variable name only", async () => {
    const { out, err, output } = collect();

    const code = await executeCli({
      argv: ["recover-super-admin"],
      open: async () => {
        throw new Error("connect ECONNREFUSED postgresql://user:hunter2@db/heat");
      },
      output,
      hostname: "box",
      environment: { DATABASE_URL: "postgresql://user:hunter2@db/heat" },
    });

    expect(code).toBe(1);
    expect(out.join("")).toBe("");
    const text = err.join("");
    expect(text).toContain("Invalid environment configuration");
    expect(text).toContain("AUTH_ACCESS_SECRET");
    expect(text).not.toContain("hunter2");
    expect(text).not.toContain("ECONNREFUSED");
  });

  test("a bootstrap failure with valid configuration prints a generic message", async () => {
    const { err, output } = collect();
    const { authTestEnvironment } = await import("../support/auth-env");

    const code = await executeCli({
      argv: ["recover-super-admin"],
      open: async () => {
        throw new Error("connect ECONNREFUSED postgresql://user:hunter2@db/heat");
      },
      output,
      hostname: "box",
      environment: {
        ...authTestEnvironment,
        DATABASE_URL: "postgresql://x",
        REDIS_URL: "redis://x",
      },
    });

    expect(code).toBe(1);
    expect(err.join("")).toContain("failed to start");
    expect(err.join("")).not.toContain("hunter2");
  });
});
