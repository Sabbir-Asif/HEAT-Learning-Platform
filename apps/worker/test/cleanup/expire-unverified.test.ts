import { describe, expect, test } from "vitest";
import {
  ExpireUnverifiedRegistrations,
  type ExpiryCandidate,
  type ExpiryMetric,
  type ExpiryStore,
} from "../../src/cleanup/expire-unverified";

const now = new Date("2026-11-12T20:00:00.000Z");
const minutes = (count: number) => count * 60 * 1000;
const days = (count: number) => count * 24 * 60 * minutes(1);
const sevenDaysAndOneMinuteAgo = new Date(now.getTime() - days(7) - minutes(1));

const candidate = (overrides: Partial<ExpiryCandidate> = {}): ExpiryCandidate => ({
  userId: "user-1",
  verificationJob: { status: "SENT", sentAt: sevenDaysAndOneMinuteAgo },
  enrollments: [{ id: "enrollment-1", status: "PENDING_VERIFICATION" }],
  ...overrides,
});

class FakeStore implements ExpiryStore {
  applied: { userId: string; enrollmentIds: string[]; deleteAccount: boolean }[] = [];
  constructor(private readonly candidates: ExpiryCandidate[]) {}
  loadCandidates(): Promise<ExpiryCandidate[]> {
    return Promise.resolve(this.candidates);
  }
  apply(userId: string, enrollmentIds: string[], deleteAccount: boolean): Promise<number> {
    this.applied.push({ userId, enrollmentIds, deleteAccount });
    return Promise.resolve(enrollmentIds.length);
  }
}

class FakeMetric implements ExpiryMetric {
  total = 0;
  add(count: number): Promise<void> {
    this.total += count;
    return Promise.resolve();
  }
}

const run = async (candidates: ExpiryCandidate[]) => {
  const store = new FakeStore(candidates);
  const metric = new FakeMetric();
  const job = new ExpireUnverifiedRegistrations(store, metric, { now: () => now });
  const expired = await job.run();
  return { store, metric, expired };
};

describe("ExpireUnverifiedRegistrations", () => {
  test("expires a registration whose email was sent 7 days and 1 minute ago and deletes the account", async () => {
    const { store, metric, expired } = await run([candidate()]);
    expect(store.applied).toEqual([
      { userId: "user-1", enrollmentIds: ["enrollment-1"], deleteAccount: true },
    ]);
    expect(expired).toBe(1);
    expect(metric.total).toBe(1);
  });

  test("expires at exactly 7 days", async () => {
    const { store } = await run([
      candidate({ verificationJob: { status: "SENT", sentAt: new Date(now.getTime() - days(7)) } }),
    ]);
    expect(store.applied).toHaveLength(1);
  });

  test("does not expire when the email was sent less than 7 days ago", async () => {
    const { store, expired } = await run([
      candidate({ verificationJob: { status: "SENT", sentAt: new Date(now.getTime() - days(3)) } }),
    ]);
    expect(store.applied).toEqual([]);
    expect(expired).toBe(0);
  });

  test("does not expire while the email is still queued", async () => {
    const { store } = await run([
      candidate({ verificationJob: { status: "QUEUED", sentAt: null } }),
    ]);
    expect(store.applied).toEqual([]);
  });

  test("does not expire when no verification email exists yet", async () => {
    const { store } = await run([candidate({ verificationJob: null })]);
    expect(store.applied).toEqual([]);
  });

  test("keeps the account when another enrollment is approved or completed", async () => {
    for (const status of ["APPROVED", "COMPLETED"] as const) {
      const { store } = await run([
        candidate({
          enrollments: [
            { id: "enrollment-1", status: "PENDING_VERIFICATION" },
            { id: "enrollment-2", status },
          ],
        }),
      ]);
      expect(store.applied).toEqual([
        { userId: "user-1", enrollmentIds: ["enrollment-1"], deleteAccount: false },
      ]);
    }
  });

  test("expires every pending enrollment of the account", async () => {
    const { store } = await run([
      candidate({
        enrollments: [
          { id: "enrollment-1", status: "PENDING_VERIFICATION" },
          { id: "enrollment-2", status: "PENDING_VERIFICATION" },
        ],
      }),
    ]);
    expect(store.applied[0]?.enrollmentIds).toEqual(["enrollment-1", "enrollment-2"]);
  });

  test("a second run over an already expired account changes nothing", async () => {
    const { store, metric, expired } = await run([
      candidate({ enrollments: [{ id: "enrollment-1", status: "EXPIRED" }] }),
    ]);
    expect(store.applied).toEqual([]);
    expect(expired).toBe(0);
    expect(metric.total).toBe(0);
  });
});
