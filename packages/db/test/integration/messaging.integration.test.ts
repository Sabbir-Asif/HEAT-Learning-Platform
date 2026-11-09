import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

let database: TestDatabase;

beforeAll(async () => {
  database = await withDatabase();
});

afterAll(async () => {
  await database.close();
});

const unique = () => Math.random().toString(36).slice(2);

const createStudent = () =>
  database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "STUDENT",
      realm: "STUDENT",
    },
  });

describe("outbox", () => {
  test("an event is unprocessed until the relay marks it", async () => {
    const event = await database.prisma.outbox.create({
      data: { eventType: "enrollment.approved", payload: { enrollmentId: "abc" } },
    });

    expect(event.processedAt).toBeNull();
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.payload).toEqual({ enrollmentId: "abc" });
  });
});

describe("email jobs", () => {
  test("a new job is queued, in English, with no attempts", async () => {
    const student = await createStudent();

    const job = await database.prisma.emailJob.create({
      data: {
        userId: student.id,
        recipientAddress: "learner@example.com",
        category: "VERIFICATION",
        template: "verify-email",
      },
    });

    expect(job).toMatchObject({ status: "QUEUED", locale: "en", attempts: 0, sentAt: null });
  });

  test("the job still has the recipient address after the user row is soft-deleted", async () => {
    const student = await createStudent();
    const job = await database.prisma.emailJob.create({
      data: {
        userId: student.id,
        recipientAddress: "learner@example.com",
        category: "ENROLLMENT",
        template: "enrollment-approved",
        status: "SENT",
        smtpResponse: "250 2.0.0 OK",
        sentAt: new Date(),
      },
    });

    await database.prisma.$includingDeleted().user.update({
      where: { id: student.id },
      data: { deletedAt: new Date(), email: `deleted-${student.id}@example.invalid` },
    });

    const reloaded = await database.prisma.emailJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(reloaded.recipientAddress).toBe("learner@example.com");
    expect(reloaded.smtpResponse).toBe("250 2.0.0 OK");
  });

  test("a user with email jobs cannot be hard deleted", async () => {
    const student = await createStudent();
    await database.prisma.emailJob.create({
      data: {
        userId: student.id,
        recipientAddress: "learner@example.com",
        category: "PASSWORD",
        template: "reset-password",
      },
    });

    await expect(
      database.hardDeleting.user.delete({ where: { id: student.id } }),
    ).rejects.toMatchObject({
      code: "P2003",
    });
  });

  test("a job can come from an outbox event", async () => {
    const event = await database.prisma.outbox.create({
      data: { eventType: "certificate.issued", payload: {} },
    });

    const job = await database.prisma.emailJob.create({
      data: {
        outboxId: event.id,
        recipientAddress: "learner@example.com",
        category: "CERTIFICATE",
        template: "certificate-ready",
      },
    });

    expect(job.outboxId).toBe(event.id);
  });

  test("a negative attempt count is rejected", async () => {
    await expect(
      database.prisma.emailJob.create({
        data: {
          recipientAddress: "learner@example.com",
          category: "PASSWORD",
          template: "reset-password",
          attempts: -1,
        },
      }),
    ).rejects.toThrow(/EmailJob_attempts_check/);
  });
});

describe("notifications", () => {
  test("a notification is unread until the user reads it", async () => {
    const student = await createStudent();

    const notification = await database.prisma.notification.create({
      data: { userId: student.id, type: "CERTIFICATE_READY" },
    });

    expect(notification.readAt).toBeNull();
    expect(notification.data).toEqual({});
  });

  test("a notification needs an existing user", async () => {
    await expect(
      database.prisma.notification.create({
        data: { userId: crypto.randomUUID(), type: "NEWS_PUBLISHED" },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
