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
  LOCKOUT_ACCOUNT_THRESHOLD: "6",
  LOCKOUT_MEMORY_SECONDS: "3600",
});

const build = () => {
  const clock = new FakeClock();
  const store = new InMemoryLockoutStore();
  const lockout = new SignInLockout(store, new AccountKeyHasher(config), clock, config);
  return { clock, store, lockout };
};

const IP = "203.0.113.5";
const OTHER_IP = "198.51.100.8";

const waitOf = async (promise: Promise<unknown>): Promise<number | null> => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (error as { retryAfterSeconds?: number }).retryAfterSeconds ?? -1;
  }
};

describe("SignInLockout", () => {
  const fail = async (lockout: SignInLockout, times: number, ip = IP, email = "a@b.test") => {
    for (let i = 0; i < times; i++) await waitOf(lockout.reserve("student", email, ip));
  };

  test("allows attempts up to the threshold", async () => {
    const { lockout } = build();
    await fail(lockout, 3);
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBe(30);
  });

  test("allows attempts below the threshold", async () => {
    const { lockout } = build();
    await fail(lockout, 2);
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBeNull();
  });

  test("the wait doubles with each further failure and is capped", async () => {
    const { clock, lockout } = build();
    const waits: (number | null)[] = [];
    for (let i = 0; i < 11; i++) {
      const wait = await waitOf(lockout.reserve("student", "a@b.test", IP));
      waits.push(wait);
      clock.advanceSeconds(wait === null ? 0 : wait + 1);
    }
    expect(waits).toEqual([null, null, null, 30, null, 60, null, 120, null, 200, null]);
  });

  test("the lock ends on its own, so it is never permanent", async () => {
    const { clock, lockout } = build();
    await fail(lockout, 3);
    clock.advanceSeconds(31);
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBeNull();
  });

  test("attempts made while locked never extend the lock", async () => {
    const { clock, lockout } = build();
    await fail(lockout, 3);
    for (let i = 0; i < 10; i++) {
      clock.advanceSeconds(2);
      expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBe(30 - 2 * (i + 1));
    }
  });

  test("success clears the counter for that address", async () => {
    const { lockout } = build();
    await fail(lockout, 2);
    await lockout.recordSuccess("student", "a@b.test", IP);
    await fail(lockout, 2);
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBeNull();
  });

  test("a locked attacker address does not block the victim from another address", async () => {
    const { lockout } = build();
    await fail(lockout, 5, OTHER_IP);
    expect(await waitOf(lockout.reserve("student", "a@b.test", OTHER_IP))).not.toBeNull();
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBeNull();
  });

  test("attempts from IPv6 addresses in one /64 share a lock", async () => {
    const { lockout } = build();
    await fail(lockout, 3, "2001:db8:1:2::1");
    expect(await waitOf(lockout.reserve("student", "a@b.test", "2001:db8:1:2:ffff::9"))).toBe(30);
    expect(await waitOf(lockout.reserve("student", "a@b.test", "2001:db8:1:3::1"))).toBeNull();
  });

  test("failures spread over many addresses lock the account at the account ceiling", async () => {
    const { clock, lockout } = build();
    for (let i = 0; i < 6; i++) await lockout.reserve("student", "a@b.test", `192.0.2.${i + 1}`);
    expect(await waitOf(lockout.reserve("student", "a@b.test", "192.0.2.200"))).toBe(200);
    clock.advanceSeconds(201);
    expect(await waitOf(lockout.reserve("student", "a@b.test", "192.0.2.201"))).toBeNull();
  });

  test("the account lock is capped and never extended by attempts made while locked", async () => {
    const { clock, lockout } = build();
    for (let i = 0; i < 6; i++) await lockout.reserve("student", "a@b.test", `192.0.2.${i + 1}`);
    for (let i = 0; i < 20; i++) {
      clock.advanceSeconds(5);
      await waitOf(lockout.reserve("student", "a@b.test", `192.0.2.${100 + i}`));
    }
    expect(await waitOf(lockout.reserve("student", "a@b.test", "192.0.2.250"))).toBe(100);
    clock.advanceSeconds(101);
    expect(await waitOf(lockout.reserve("student", "a@b.test", "192.0.2.250"))).toBeNull();
  });

  test("one wrong guess per lock expiry cannot hold an address locked past the memory window", async () => {
    const { clock, lockout } = build();
    let elapsed = 0;
    const waits: Array<{ elapsed: number; wait: number | null }> = [];
    while (elapsed < 8000) {
      const wait = await waitOf(lockout.reserve("student", "a@b.test", IP));
      waits.push({ elapsed, wait });
      const step = wait === null ? 1 : wait + 1;
      clock.advanceSeconds(step);
      elapsed += step;
    }
    expect(Math.max(...waits.map((entry) => entry.wait ?? 0))).toBeLessThanOrEqual(200);
    const restarted = waits.filter((entry) => entry.elapsed > 3600 && entry.wait === null);
    expect(restarted.length).toBeGreaterThanOrEqual(3);
  });

  test("sparse failures do not refresh the failure memory", async () => {
    const { clock, lockout } = build();
    await fail(lockout, 2);
    clock.advanceSeconds(3000);
    await fail(lockout, 1);
    clock.advanceSeconds(700);
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBeNull();
    expect(await waitOf(lockout.reserve("student", "a@b.test", IP))).toBeNull();
  });

  test("email case does not create separate accounts, realms and accounts stay separate", async () => {
    const { lockout } = build();
    for (let i = 0; i < 3; i++) await lockout.reserve("student", "A@B.test", IP);
    expect(await waitOf(lockout.reserve("student", " a@b.test ", IP))).toBe(30);
    expect(await waitOf(lockout.reserve("admin", "a@b.test", IP))).toBeNull();
    expect(await waitOf(lockout.reserve("student", "other@b.test", IP))).toBeNull();
  });

  test("keys hold a hash, never the address", async () => {
    const { store, lockout } = build();
    await lockout.reserve("student", "ada@example.test", IP);
    const keys = [...store.entries.keys()].sort();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^lockout:student:[0-9a-f]{64}$/);
    expect(keys[1]).toMatch(/^lockout:student:[0-9a-f]{64}:203\.0\.113\.5$/);
    expect(keys.join()).not.toContain("ada");
  });

  test("a missing client address is bucketed together with a warning", async () => {
    const { store, lockout } = build();
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    await lockout.reserve("student", "ada@example.test", undefined);
    expect([...store.entries.keys()].some((key) => key.endsWith(":unknown"))).toBe(true);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ada");
    warn.mockRestore();
  });

  test("fails open with a warning that carries no address when the store is down", async () => {
    const { store, lockout } = build();
    store.failing = true;
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    expect(await waitOf(lockout.reserve("student", "ada@example.test", IP))).toBeNull();
    await lockout.recordSuccess("student", "ada@example.test", IP);
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ada");
    warn.mockRestore();
  });
});
