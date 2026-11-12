import { describe, expect, test } from "vitest";
import {
  EmailQuota,
  type EmailQuotaConfig,
  type QuotaEntry,
  type QuotaLedger,
} from "../../src/email/email-quota";

const hour = 3600_000;
const day = 24 * hour;

class MemoryLedger implements QuotaLedger {
  private entries = new Map<string, QuotaEntry>();
  private sequence = 0;

  record(category: QuotaEntry["category"], at: Date): Promise<string> {
    this.sequence += 1;
    const id = `e${String(this.sequence)}`;
    this.entries.set(id, { id, category, at });
    return Promise.resolve(id);
  }
  release(id: string): Promise<void> {
    this.entries.delete(id);
    return Promise.resolve();
  }
  entriesSince(since: Date): Promise<QuotaEntry[]> {
    return Promise.resolve(
      [...this.entries.values()]
        .filter((entry) => entry.at.getTime() > since.getTime())
        .sort((a, b) => a.at.getTime() - b.at.getTime()),
    );
  }
}

const config = (overrides: Partial<EmailQuotaConfig> = {}): EmailQuotaConfig => ({
  totalLimit: 10,
  reservedForPriority: 2,
  budgets: { VERIFICATION: 10, PASSWORD: 10, ENROLLMENT: 3, CERTIFICATE: 3 },
  ...overrides,
});

const start = new Date("2026-11-11T10:00:00Z");
const after = (ms: number) => new Date(start.getTime() + ms);

describe("EmailQuota", () => {
  test("delays an email when its category budget is used up while verification still goes out", async () => {
    const quota = new EmailQuota(new MemoryLedger(), config());
    for (let i = 0; i < 3; i += 1) {
      expect(await quota.reserve("ENROLLMENT", start)).toMatchObject({ granted: true });
    }

    const denied = await quota.reserve("ENROLLMENT", after(hour));
    expect(denied).toEqual({ granted: false, retryAt: after(day) });
    expect(await quota.reserve("VERIFICATION", after(hour))).toMatchObject({ granted: true });
  });

  test("with a total limit of 5, three of eight emails wait and send once the window rolls forward", async () => {
    const quota = new EmailQuota(
      new MemoryLedger(),
      config({ totalLimit: 5, reservedForPriority: 0 }),
    );
    const results = [];
    for (let i = 0; i < 8; i += 1) {
      results.push(await quota.reserve("VERIFICATION", after(i * 1000)));
    }
    expect(results.filter((result) => result.granted)).toHaveLength(5);
    const waiting = results.filter((result) => !result.granted);
    expect(waiting).toHaveLength(3);
    expect(waiting[0]).toEqual({ granted: false, retryAt: after(day) });

    expect(await quota.reserve("VERIFICATION", after(day + 1))).toMatchObject({ granted: true });
    expect(await quota.reserve("VERIFICATION", after(day + 1000))).toMatchObject({
      granted: true,
    });
  });

  test("keeps the reserved capacity for verification and password mail", async () => {
    const quota = new EmailQuota(
      new MemoryLedger(),
      config({ totalLimit: 4, reservedForPriority: 2 }),
    );
    expect(await quota.reserve("CERTIFICATE", start)).toMatchObject({ granted: true });
    expect(await quota.reserve("ENROLLMENT", after(1000))).toMatchObject({ granted: true });

    expect(await quota.reserve("CERTIFICATE", after(2000))).toEqual({
      granted: false,
      retryAt: after(day),
    });
    expect(await quota.reserve("PASSWORD", after(2000))).toMatchObject({ granted: true });
    expect(await quota.reserve("VERIFICATION", after(3000))).toMatchObject({ granted: true });
    expect(await quota.reserve("VERIFICATION", after(4000))).toMatchObject({ granted: false });
  });

  test("counts a rolling 24 hours, not a calendar day", async () => {
    const quota = new EmailQuota(
      new MemoryLedger(),
      config({ totalLimit: 1, reservedForPriority: 0 }),
    );
    const lateEvening = new Date("2026-11-11T17:30:00Z");
    expect(await quota.reserve("VERIFICATION", lateEvening)).toMatchObject({ granted: true });

    const pastDhakaMidnight = new Date("2026-11-11T18:30:00Z");
    expect(await quota.reserve("VERIFICATION", pastDhakaMidnight)).toMatchObject({
      granted: false,
    });
    expect(
      await quota.reserve("VERIFICATION", new Date(lateEvening.getTime() + day)),
    ).toMatchObject({ granted: true });
  });

  test("a released reservation frees its slot", async () => {
    const quota = new EmailQuota(
      new MemoryLedger(),
      config({ totalLimit: 1, reservedForPriority: 0 }),
    );
    const first = await quota.reserve("VERIFICATION", start);
    if (!first.granted) throw new Error("expected a grant");
    await quota.release(first.reservationId);
    expect(await quota.reserve("VERIFICATION", after(1000))).toMatchObject({ granted: true });
  });

  test("reports sent today and the remaining quota per category", async () => {
    const quota = new EmailQuota(new MemoryLedger(), config());
    await quota.reserve("ENROLLMENT", start);
    await quota.reserve("VERIFICATION", start);

    expect(await quota.status(after(hour))).toEqual({
      used: 2,
      remainingTotal: 8,
      remaining: { VERIFICATION: 8, PASSWORD: 8, ENROLLMENT: 2, CERTIFICATE: 3 },
    });
  });

  test("quotaResumeAt is when the oldest counted email leaves the window, or an hour out when none", async () => {
    const quota = new EmailQuota(new MemoryLedger(), config());
    expect(await quota.resumeAt(start)).toEqual(after(hour));
    await quota.reserve("VERIFICATION", after(2 * hour));
    await quota.reserve("VERIFICATION", after(3 * hour));
    expect(await quota.resumeAt(after(4 * hour))).toEqual(after(2 * hour + day));
  });
});
