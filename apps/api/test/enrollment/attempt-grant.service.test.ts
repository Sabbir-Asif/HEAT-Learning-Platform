import { describe, expect, test, vi } from "vitest";
import { AttemptGrantService } from "../../src/enrollment/attempt-grant.service";

const now = new Date("2026-11-12T10:00:00.000Z");
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };
const failed = (submittedAt: string) => ({ passed: false, submittedAt: new Date(submittedAt) });

interface Options {
  enrollment?: object | null;
  quiz?: object | null;
  attempts?: object[];
  grants?: { extraAttempts: number }[];
}

const build = (options: Options = {}) => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.enrollment === undefined
            ? { id: "e", status: "APPROVED", userId: "student-id", courseRevisionId: "rev" }
            : options.enrollment,
        ),
    },
    quiz: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.quiz === undefined ? { id: "q", attemptLimit: 2, waitMinutes: 10 } : options.quiz,
        ),
    },
    quizAttempt: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          options.attempts ?? [
            failed("2026-11-12T08:00:00.000Z"),
            failed("2026-11-12T09:00:00.000Z"),
          ],
        ),
    },
    attemptGrant: {
      findMany: vi.fn().mockResolvedValue(options.grants ?? []),
      create: vi.fn().mockResolvedValue({ id: "grant-id" }),
    },
  };
  const database = {
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new AttemptGrantService(database as never, { now: () => now }, audit as never);
  return { service, tx, audit };
};

describe("AttemptGrantService.grant", () => {
  test("stores one extra attempt and audits admin, student, quiz and reason", async () => {
    const { service, tx, audit } = build();

    const result = await service.grant("e", "q", actor, "Power cut");

    expect(result).toEqual({ id: "grant-id", quizId: "q", grantedAttempts: 1 });
    expect(tx.attemptGrant.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          enrollmentId: "e",
          quizId: "q",
          adminId: "admin-id",
          extraAttempts: 1,
          grantedAt: now,
          reason: "Power cut",
        },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(tx, actor, {
      action: "quiz.attempt_grant",
      entity: "AttemptGrant",
      entityId: "grant-id",
      after: { enrollmentId: "e", studentId: "student-id", quizId: "q", reason: "Power cut" },
    });
  });

  test("locks the enrollment row before reading attempts and grants", async () => {
    const { service, tx } = build();

    await service.grant("e", "q", actor, undefined);

    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0] ?? 0;
    const readOrder = tx.quizAttempt.findMany.mock.invocationCallOrder[0] ?? 0;
    expect(lockOrder).toBeGreaterThan(0);
    expect(lockOrder).toBeLessThan(readOrder);
  });

  test("omits the reason when none is given", async () => {
    const { service, tx, audit } = build();

    await service.grant("e", "q", actor, undefined);

    expect(tx.attemptGrant.create.mock.calls[0]?.[0].data).not.toHaveProperty("reason");
    expect(audit.record.mock.calls[0]?.[2].after).not.toHaveProperty("reason");
  });

  test("counts earlier grants in the total", async () => {
    const { service } = build({
      grants: [{ extraAttempts: 1 }],
      attempts: [
        failed("2026-11-12T07:00:00.000Z"),
        failed("2026-11-12T08:00:00.000Z"),
        failed("2026-11-12T09:00:00.000Z"),
      ],
    });

    expect((await service.grant("e", "q", actor, undefined)).grantedAttempts).toBe(2);
  });

  test("answers not found for an unknown enrollment or one without a revision", async () => {
    await expect(
      build({ enrollment: null }).service.grant("e", "q", actor, undefined),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      build({
        enrollment: { id: "e", status: "APPROVED", userId: "u", courseRevisionId: null },
      }).service.grant("e", "q", actor, undefined),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("answers not found for a quiz outside the enrollment's revision", async () => {
    const { service, tx, audit } = build({ quiz: null });

    await expect(service.grant("e", "q", actor, undefined)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(tx.attemptGrant.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  test("refuses by the rules without writing", async () => {
    const unlimited = build({ quiz: { id: "q", attemptLimit: null, waitMinutes: 10 } });
    await expect(unlimited.service.grant("e", "q", actor, undefined)).rejects.toMatchObject({
      code: "QUIZ_ATTEMPTS_UNLIMITED",
    });
    expect(unlimited.tx.attemptGrant.create).not.toHaveBeenCalled();

    const remaining = build({ attempts: [failed("2026-11-12T08:00:00.000Z")] });
    await expect(remaining.service.grant("e", "q", actor, undefined)).rejects.toMatchObject({
      code: "QUIZ_GRANT_NOT_NEEDED",
    });
    expect(remaining.audit.record).not.toHaveBeenCalled();
  });

  test("ignores attempts that were never submitted", async () => {
    const { service } = build({
      attempts: [
        failed("2026-11-12T08:00:00.000Z"),
        failed("2026-11-12T09:00:00.000Z"),
        { passed: null, submittedAt: null },
      ],
    });

    await expect(service.grant("e", "q", actor, undefined)).resolves.toMatchObject({
      grantedAttempts: 1,
    });
  });
});
