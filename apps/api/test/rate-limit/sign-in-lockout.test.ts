import { describe, expect, test, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { loadConfig } from "../../src/core";
import { AccountKeyHasher } from "../../src/rate-limit/account-key.hasher";
import { SignInLockout } from "../../src/rate-limit/sign-in-lockout.service";
import { authTestEnvironment } from "../support/auth-env";
import { FakeClock, InMemoryLockoutStore } from "../support/fakes";

const config = loadConfig({
  ...authTestEnvironment,
  DATABASE_URL: "postgresql://x",
  REDIS_URL: "redis://x",
  LOCKOUT_THRESHOLD: "3",
  LOCKOUT_BASE_SECONDS: "30",
  LOCKOUT_MAX_SECONDS: "200",
});

const build = () => {
  const clock = new FakeClock();
  const store = new InMemoryLockoutStore();
  const lockout = new SignInLockout(store, new AccountKeyHasher(config), clock, config);
  return { clock, store, lockout };
};

const waitOf = async (promise: Promise<unknown>): Promise<number | null> => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (error as { retryAfterSeconds?: number }).retryAfterSeconds ?? -1;
  }
};

describe("SignInLockout", () => {
  test("allows attempts below the threshold", async () => {
    const { lockout } = build();
    await lockout.recordFailure("student", "a@b.test");
    await lockout.recordFailure("student", "a@b.test");
    expect(await waitOf(lockout.assertOpen("student", "a@b.test"))).toBeNull();
  });

  test("locks at the threshold with Retry-After equal to the base wait", async () => {
    const { lockout } = build();
    for (let i = 0; i < 3; i++) await lockout.recordFailure("student", "a@b.test");
    expect(await waitOf(lockout.assertOpen("student", "a@b.test"))).toBe(30);
  });

  test("the wait doubles with each further failure and is capped", async () => {
    const { clock, lockout } = build();
    const waits: (number | null)[] = [];
    for (let i = 0; i < 7; i++) {
      await lockout.recordFailure("student", "a@b.test");
      waits.push(await waitOf(lockout.assertOpen("student", "a@b.test")));
      clock.advanceMinutes(10);
    }
    expect(waits).toEqual([null, null, 30, 60, 120, 200, 200]);
  });

  test("the lock ends on its own, so it is never permanent", async () => {
    const { clock, lockout } = build();
    for (let i = 0; i < 3; i++) await lockout.recordFailure("student", "a@b.test");
    clock.advanceSeconds(31);
    expect(await waitOf(lockout.assertOpen("student", "a@b.test"))).toBeNull();
  });

  test("success clears the counter", async () => {
    const { lockout } = build();
    for (let i = 0; i < 3; i++) await lockout.recordFailure("student", "a@b.test");
    await lockout.recordSuccess("student", "a@b.test");
    expect(await waitOf(lockout.assertOpen("student", "a@b.test"))).toBeNull();
    await lockout.recordFailure("student", "a@b.test");
    expect(await waitOf(lockout.assertOpen("student", "a@b.test"))).toBeNull();
  });

  test("email case does not create separate accounts, realms and accounts stay separate", async () => {
    const { lockout } = build();
    for (let i = 0; i < 3; i++) await lockout.recordFailure("student", "A@B.test");
    expect(await waitOf(lockout.assertOpen("student", " a@b.test "))).toBe(30);
    expect(await waitOf(lockout.assertOpen("admin", "a@b.test"))).toBeNull();
    expect(await waitOf(lockout.assertOpen("student", "other@b.test"))).toBeNull();
  });

  test("keys hold a hash, never the address", async () => {
    const { store, lockout } = build();
    await lockout.recordFailure("student", "ada@example.test");
    const keys = [...store.entries.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^lockout:student:[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain("ada");
  });

  test("fails open with a warning that carries no address when the store is down", async () => {
    const { store, lockout } = build();
    store.failing = true;
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    await lockout.recordFailure("student", "ada@example.test");
    expect(await waitOf(lockout.assertOpen("student", "ada@example.test"))).toBeNull();
    await lockout.recordSuccess("student", "ada@example.test");
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ada");
    warn.mockRestore();
  });
});
