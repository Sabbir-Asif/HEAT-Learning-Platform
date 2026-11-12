import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { QuotaEntry, QuotaLedger } from "./email-quota";
import { quotaWindowMs } from "./email-quota";
import { emailCategories, type EmailCategory } from "./email-template";

const ledgerKey = "email:quota:ledger";

const isCategory = (value: string): value is EmailCategory =>
  emailCategories.some((category) => category === value);

export class RedisQuotaLedger implements QuotaLedger {
  constructor(private readonly redis: Redis) {}

  async record(category: EmailCategory, at: Date): Promise<string> {
    const id = `${category}:${randomUUID()}`;
    await this.redis.zadd(ledgerKey, at.getTime(), id);
    return id;
  }

  async release(id: string): Promise<void> {
    await this.redis.zrem(ledgerKey, id);
  }

  async entriesSince(since: Date): Promise<QuotaEntry[]> {
    await this.redis.zremrangebyscore(ledgerKey, "-inf", since.getTime() - quotaWindowMs);
    const raw = await this.redis.zrangebyscore(
      ledgerKey,
      `(${String(since.getTime())}`,
      "+inf",
      "WITHSCORES",
    );
    const entries: QuotaEntry[] = [];
    for (let index = 0; index + 1 < raw.length; index += 2) {
      const id = raw[index];
      const score = raw[index + 1];
      const category = id?.split(":")[0];
      if (id === undefined || score === undefined || category === undefined) continue;
      if (isCategory(category)) entries.push({ id, category, at: new Date(Number(score)) });
    }
    return entries;
  }
}
