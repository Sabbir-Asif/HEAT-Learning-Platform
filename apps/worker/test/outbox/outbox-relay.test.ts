import { describe, expect, test } from "vitest";
import {
  OutboxRelay,
  type EmailJobRecord,
  type JobQueue,
  type OutboxEvent,
  type OutboxStore,
  type RelayTransaction,
} from "../../src/outbox/outbox-relay";
import { readOutboxLagSeconds } from "../../src/outbox/outbox-lag";

const userId = "0194f3a0-0000-7000-8000-000000000001";
const enrollmentId = "0194f3a0-0000-7000-8000-000000000002";

class FakeStore implements OutboxStore {
  readonly unrelayed: OutboxEvent[] = [];
  readonly relayedIds: string[] = [];
  readonly emailJobs: EmailJobRecord[] = [];
  readonly notifications: { userId: string; type: string }[] = [];
  recipients = new Map<string, string>([[userId, "amina@du.ac.bd"]]);

  async relayNext(
    work: (event: OutboxEvent, transaction: RelayTransaction) => Promise<void>,
  ): Promise<boolean> {
    const event = this.unrelayed[0];
    if (event === undefined) return false;
    const stagedJobs: EmailJobRecord[] = [];
    const stagedNotifications: { userId: string; type: string }[] = [];
    await work(event, {
      findRecipientAddress: (id) => Promise.resolve(this.recipients.get(id) ?? null),
      recordEmailJob: (job) => {
        stagedJobs.push(job);
        return Promise.resolve();
      },
      createNotification: (notification) => {
        stagedNotifications.push(notification);
        return Promise.resolve();
      },
    });
    this.emailJobs.push(...stagedJobs);
    this.notifications.push(...stagedNotifications);
    this.relayedIds.push(event.id);
    this.unrelayed.shift();
    return true;
  }

  oldestUnrelayedAt(): Promise<Date | null> {
    return Promise.resolve(this.unrelayed[0]?.createdAt ?? null);
  }
}

class FakeQueue implements JobQueue {
  readonly jobs = new Map<string, Record<string, string>>();
  down = false;
  adds = 0;

  add(jobId: string, data: Record<string, string>): Promise<void> {
    this.adds += 1;
    if (this.down) return Promise.reject(new Error("Redis is down"));
    if (!this.jobs.has(jobId)) this.jobs.set(jobId, data);
    return Promise.resolve();
  }
}

const event = (id: string, eventType: string, payload: unknown): OutboxEvent => ({
  id,
  eventType,
  payload,
  createdAt: new Date("2026-11-11T10:00:00Z"),
});

const alreadyRegistered = (id: string): OutboxEvent =>
  event(id, "student.registration.already_registered", {
    template: "student-already-registered",
    userId,
  });

const setup = () => {
  const store = new FakeStore();
  const email = new FakeQueue();
  const certificate = new FakeQueue();
  const transcode = new FakeQueue();
  const errors: string[] = [];
  const warnings: string[] = [];
  const relay = new OutboxRelay(
    store,
    { email, certificate, transcode },
    { now: () => new Date("2026-11-11T10:05:00Z") },
    { warn: (line) => warnings.push(line), error: (line) => errors.push(line) },
  );
  return { store, email, certificate, transcode, relay, errors, warnings };
};

describe("OutboxRelay", () => {
  test("enqueues an email job with the outbox id as job id and keeps a recipient copy", async () => {
    const { store, email, relay } = setup();
    store.unrelayed.push(alreadyRegistered("job-1"));

    const result = await relay.relayBatch(10);

    expect(result).toEqual({ relayed: 1, stoppedOnError: false });
    expect(email.jobs.get("job-1")).toEqual({ emailJobId: "job-1" });
    expect(store.emailJobs).toEqual([
      {
        id: "job-1",
        outboxId: "job-1",
        userId,
        recipientAddress: "amina@du.ac.bd",
        category: "VERIFICATION",
        template: "student-already-registered",
      },
    ]);
    expect(store.relayedIds).toEqual(["job-1"]);
  });

  test("leaves the row unrelayed while Redis is down and relays it once Redis returns", async () => {
    const { store, email, relay, errors } = setup();
    store.unrelayed.push(alreadyRegistered("job-1"));
    email.down = true;

    const outage = await relay.relayBatch(10);

    expect(outage).toEqual({ relayed: 0, stoppedOnError: true });
    expect(store.relayedIds).toEqual([]);
    expect(store.emailJobs).toEqual([]);
    expect(errors).toEqual(["Outbox relay stopped: Redis is down"]);

    email.down = false;
    const recovered = await relay.relayBatch(10);

    expect(recovered).toEqual({ relayed: 1, stoppedOnError: false });
    expect(store.relayedIds).toEqual(["job-1"]);
    expect(email.jobs.size).toBe(1);
  });

  test("does not enqueue twice when a crash happened between enqueue and mark", async () => {
    const { store, email, relay } = setup();
    store.unrelayed.push(alreadyRegistered("job-1"));
    await email.add("job-1", { emailJobId: "job-1" });

    await relay.relayBatch(10);

    expect(email.jobs.size).toBe(1);
    expect(store.relayedIds).toEqual(["job-1"]);
  });

  test("routes certificate requests to the certificate queue with the outbox id", async () => {
    const { store, certificate, relay } = setup();
    store.unrelayed.push(event("job-2", "certificate.requested", { enrollmentId }));

    await relay.relayBatch(10);

    expect(certificate.jobs.get("job-2")).toEqual({ outboxId: "job-2", enrollmentId });
  });

  test("routes an uploaded video to the transcode queue with the outbox id", async () => {
    const { store, transcode, relay } = setup();
    const assetId = "0194f3a0-0000-7000-8000-000000000009";
    store.unrelayed.push(event("job-4", "video.uploaded", { assetId }));

    await relay.relayBatch(10);

    expect(transcode.jobs.get("job-4")).toEqual({ outboxId: "job-4", assetId });
    expect(store.relayedIds).toContain("job-4");
  });

  test("creates an in-app notification", async () => {
    const { store, relay } = setup();
    store.unrelayed.push(
      event("job-3", "enrollment.approved", {
        userId,
        notification: { type: "ENROLLMENT_APPROVED" },
      }),
    );

    await relay.relayBatch(10);

    expect(store.notifications).toEqual([{ userId, type: "ENROLLMENT_APPROVED", data: {} }]);
  });

  test("marks events nothing consumes as relayed and warns", async () => {
    const { store, email, relay, warnings } = setup();
    store.unrelayed.push(event("job-4", "EnrollmentRequested", { userId }));

    await relay.relayBatch(10);

    expect(store.relayedIds).toEqual(["job-4"]);
    expect(email.adds).toBe(0);
    expect(warnings).toEqual([
      "Outbox job-4 EnrollmentRequested not relayed: no consumer for event type",
    ]);
  });

  test("skips the email but relays the row when the recipient no longer exists", async () => {
    const { store, email, relay, warnings } = setup();
    store.recipients.clear();
    store.unrelayed.push(alreadyRegistered("job-5"));

    await relay.relayBatch(10);

    expect(email.adds).toBe(0);
    expect(store.relayedIds).toEqual(["job-5"]);
    expect(warnings).toEqual(["Outbox job-5 has no recipient, email skipped"]);
  });

  test("relays at most the batch limit and keeps order", async () => {
    const { store, relay } = setup();
    store.unrelayed.push(alreadyRegistered("a"), alreadyRegistered("b"), alreadyRegistered("c"));

    const result = await relay.relayBatch(2);

    expect(result.relayed).toBe(2);
    expect(store.relayedIds).toEqual(["a", "b"]);
  });

  test("stops at an empty outbox", async () => {
    const { relay } = setup();
    expect(await relay.relayBatch(5)).toEqual({ relayed: 0, stoppedOnError: false });
  });
});

describe("readOutboxLagSeconds", () => {
  test("is the age of the oldest unrelayed row, and zero when the outbox is empty", async () => {
    const { store } = setup();
    const clock = { now: () => new Date("2026-11-11T10:05:00Z") };
    expect(await readOutboxLagSeconds(store, clock)).toBe(0);
    store.unrelayed.push(alreadyRegistered("a"));
    expect(await readOutboxLagSeconds(store, clock)).toBe(300);
  });
});
