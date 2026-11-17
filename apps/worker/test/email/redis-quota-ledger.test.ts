import { describe, expect, test } from "vitest";
import type { Redis } from "ioredis";
import { quotaWindowMs } from "../../src/email/email-quota";
import { RedisQuotaLedger } from "../../src/email/redis-quota-ledger";

class FakeRedis {
  readonly members = new Map<string, number>();

  async zadd(_key: string, score: number, member: string): Promise<void> {
    this.members.set(member, score);
  }

  async zrem(_key: string, member: string): Promise<void> {
    this.members.delete(member);
  }

  async zremrangebyscore(_key: string, _min: string, max: number): Promise<void> {
    for (const [member, score] of this.members) if (score <= max) this.members.delete(member);
  }

  async zrangebyscore(_key: string, min: string): Promise<string[]> {
    const exclusiveMin = Number(min.slice(1));
    return [...this.members]
      .filter(([, score]) => score > exclusiveMin)
      .sort((a, b) => a[1] - b[1])
      .flatMap(([member, score]) => [member, String(score)]);
  }
}

const ledgerOver = (redis: FakeRedis): RedisQuotaLedger =>
  new RedisQuotaLedger(redis as unknown as Redis);

const now = new Date("2026-11-17T10:00:00.000Z");

describe("RedisQuotaLedger", () => {
  test("returns recorded entries with their category and time in order", async () => {
    const ledger = ledgerOver(new FakeRedis());
    const earlier = new Date(now.getTime() - 1000);
    await ledger.record("PASSWORD", now);
    await ledger.record("VERIFICATION", earlier);
    const entries = await ledger.entriesSince(new Date(now.getTime() - quotaWindowMs));
    expect(entries.map((entry) => [entry.category, entry.at])).toEqual([
      ["VERIFICATION", earlier],
      ["PASSWORD", now],
    ]);
  });

  test("a released reservation no longer counts", async () => {
    const ledger = ledgerOver(new FakeRedis());
    const id = await ledger.record("ENROLLMENT", now);
    await ledger.release(id);
    expect(await ledger.entriesSince(new Date(now.getTime() - quotaWindowMs))).toEqual([]);
  });

  test("drops entries older than the window and ignores unknown categories", async () => {
    const redis = new FakeRedis();
    const ledger = ledgerOver(redis);
    const since = new Date(now.getTime() - quotaWindowMs);
    await ledger.record("CERTIFICATE", new Date(since.getTime() - quotaWindowMs - 1));
    redis.members.set("UNKNOWN:1", now.getTime());
    await ledger.record("CERTIFICATE", now);
    const entries = await ledger.entriesSince(since);
    expect(entries.map((entry) => entry.category)).toEqual(["CERTIFICATE"]);
    expect(redis.members.size).toBe(2);
  });
});
