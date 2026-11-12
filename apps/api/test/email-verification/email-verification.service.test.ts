import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { hashOpaqueToken } from "../../src/auth";
import { EmailVerificationService } from "../../src/email-verification/email-verification.service";

const now = new Date("2026-11-10T00:00:00.000Z");
const registeredAt = new Date("2026-11-09T00:00:00.000Z");

const build = (
  options: {
    claimCount?: number;
    row?: unknown;
    verifiedCount?: number;
    user?: unknown;
    exhausted?: boolean;
    issued?: unknown;
    held?: unknown[];
  } = {},
) => {
  const order: string[] = [];
  const row =
    "row" in options
      ? options.row
      : {
          userId: "user-id",
          purpose: "VERIFY_EMAIL",
          usedAt: now,
          expiresAt: new Date(now.getTime() + 1000),
        };
  const tx = {
    $executeRaw: vi.fn().mockImplementation(async () => {
      order.push("lock");
      return 1;
    }),
    $queryRaw: vi.fn().mockResolvedValue([{ id: "user-id" }]),
    authToken: {
      updateMany: vi.fn().mockResolvedValue({ count: options.claimCount ?? 1 }),
      findUnique: vi.fn().mockResolvedValue(row),
    },
    user: {
      updateMany: vi.fn().mockResolvedValue({ count: options.verifiedCount ?? 1 }),
      findFirst: vi
        .fn()
        .mockResolvedValue(
          "user" in options ? options.user : { id: "user-id", createdAt: registeredAt },
        ),
    },
    enrollment: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue(options.held ?? []),
    },
    outbox: {
      create: vi.fn().mockImplementation(async () => {
        order.push("outbox");
        return {};
      }),
    },
  };
  const database = {
    $transaction: vi
      .fn()
      .mockImplementation(async (work: (client: unknown) => unknown) => work(tx)),
  };
  const tokens = {
    resendsExhausted: vi.fn().mockResolvedValue(options.exhausted ?? false),
    issue: vi.fn().mockImplementation(async () => {
      order.push("issue");
      return "issued" in options
        ? options.issued
        : { encryptedToken: "sealed", expiresAt: new Date(now.getTime() + 1000) };
    }),
  };
  const sessions = {
    verificationTimestamp: vi.fn().mockReturnValue(now),
    revokeSessionsBeforeVerification: vi.fn().mockImplementation(async () => {
      order.push("revoke");
    }),
    issueSessionAfterCommit: vi.fn().mockImplementation(async () => {
      order.push("session");
      return { accessToken: "a", refreshToken: "r" };
    }),
  };
  const captcha = {
    verify: vi.fn().mockImplementation(async () => {
      order.push("captcha");
    }),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const timing = { equalise: vi.fn().mockImplementation((work: () => unknown) => work()) };
  const service = new EmailVerificationService(
    database as never,
    { now: () => now } as never,
    tokens as never,
    sessions as never,
    captcha as never,
    audit as never,
    timing as never,
  );
  return { service, tx, database, tokens, sessions, captcha, audit, timing, order };
};

const resendRequest = {
  email: "anne@example.com",
  captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
  captchaAnswer: "AB12",
};

describe("EmailVerificationService.confirm", () => {
  test("claims the hashed token once, verifies, moves the enrollment, revokes and audits", async () => {
    const { service, tx, sessions, audit, order } = build();

    const result = await service.confirm("plain-token", { ipAddress: "203.0.113.4" });

    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: hashOpaqueToken("plain-token"),
        purpose: "VERIFY_EMAIL",
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { emailVerifiedAt: now } }),
    );
    expect(tx.enrollment.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", status: "PENDING_VERIFICATION", deletedAt: null },
      data: { status: "PENDING_APPROVAL", verifiedAt: now },
    });
    expect(sessions.revokeSessionsBeforeVerification).toHaveBeenCalledWith("user-id", now, tx);
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ actorId: "user-id" }),
      expect.objectContaining({ action: "student.email.verified", entityId: "user-id" }),
    );
    expect(result).toEqual({ userId: "user-id", tokens: { accessToken: "a", refreshToken: "r" } });
    expect(order).toEqual(["revoke", "session"]);
  });

  test("requests a certificate for each completed enrollment that has none, in the same transaction", async () => {
    const { service, tx } = build({
      held: [
        { id: "enrollment-1", courseId: "course-1" },
        { id: "enrollment-2", courseId: "course-2" },
      ],
    });

    await service.confirm("plain-token", { ipAddress: "203.0.113.4" });

    expect(tx.enrollment.findMany).toHaveBeenCalledWith({
      where: { userId: "user-id", status: "COMPLETED", deletedAt: null, certificate: null },
      select: { id: true, courseId: true },
    });
    expect(tx.outbox.create).toHaveBeenCalledTimes(2);
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: "certificate.requested",
        payload: { enrollmentId: "enrollment-1", userId: "user-id", courseId: "course-1" },
      },
    });
  });

  test("requests no certificate when nothing is held", async () => {
    const { service, tx } = build();
    await service.confirm("plain-token", { ipAddress: "203.0.113.4" });
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("signs the student in on a fresh session only after the transaction", async () => {
    const { service, sessions, database } = build();

    await service.confirm("plain-token", { userAgent: "agent", ipAddress: "203.0.113.4" });

    expect(database.$transaction).toHaveBeenCalledTimes(1);
    expect(sessions.issueSessionAfterCommit).toHaveBeenCalledWith("user-id", {
      userAgent: "agent",
      ipAddress: "203.0.113.4",
    });
  });

  test("a lost claim on a used token answers 409 and changes nothing else", async () => {
    const { service, tx, sessions } = build({ claimCount: 0 });

    await expect(service.confirm("t", {})).rejects.toMatchObject({
      code: "VERIFICATION_LINK_USED",
      status: 409,
    });
    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(sessions.issueSessionAfterCommit).not.toHaveBeenCalled();
  });

  test("an expired token answers 410", async () => {
    const { service } = build({
      claimCount: 0,
      row: {
        userId: "user-id",
        purpose: "VERIFY_EMAIL",
        usedAt: null,
        expiresAt: new Date(now.getTime() - 1),
      },
    });

    await expect(service.confirm("t", {})).rejects.toMatchObject({
      code: "VERIFICATION_LINK_EXPIRED",
      status: 410,
    });
  });

  test("an unknown or tampered token answers 404", async () => {
    const { service } = build({ claimCount: 0, row: null });

    await expect(service.confirm("t", {})).rejects.toMatchObject({
      code: "VERIFICATION_LINK_INVALID",
      status: 404,
    });
  });

  test("a claimed token whose user cannot be verified is refused and rolls back", async () => {
    const { service, tx, sessions } = build({ verifiedCount: 0 });

    await expect(service.confirm("t", {})).rejects.toMatchObject({
      code: "VERIFICATION_LINK_INVALID",
    });
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(sessions.issueSessionAfterCommit).not.toHaveBeenCalled();
  });
});

describe("EmailVerificationService.resend", () => {
  test("verifies the captcha before anything else and aborts when it fails", async () => {
    const { service, captcha, database, timing } = build();
    captcha.verify.mockRejectedValue(new ApiException(400, "CAPTCHA_INVALID"));

    await expect(service.resend(resendRequest)).rejects.toMatchObject({ code: "CAPTCHA_INVALID" });

    expect(database.$transaction).not.toHaveBeenCalled();
    expect(timing.equalise).not.toHaveBeenCalled();
  });

  test("locks per email, supersedes and queues one outbox event with the sealed token", async () => {
    const { service, tx, tokens, order } = build();

    expect(await service.resend(resendRequest)).toEqual({ accepted: true });

    expect(order).toEqual(["captcha", "lock", "issue", "outbox"]);
    expect(tokens.issue).toHaveBeenCalledWith(tx, { id: "user-id", createdAt: registeredAt });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: "student.verification.resend",
        payload: { template: "student-verification", userId: "user-id", encryptedToken: "sealed" },
      },
    });
  });

  test("past the cap answers 429 and queues nothing", async () => {
    const { service, tx, tokens } = build({ exhausted: true });

    await expect(service.resend(resendRequest)).rejects.toMatchObject({
      code: "VERIFICATION_RESEND_LIMIT",
      status: 429,
    });
    expect(tokens.issue).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("an unknown, verified or non-student email is accepted silently without a write", async () => {
    const { service, tx, tokens } = build({ user: null });

    expect(await service.resend(resendRequest)).toEqual({ accepted: true });

    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          realm: "STUDENT",
          emailVerifiedAt: null,
          deletedAt: null,
        }),
      }),
    );
    expect(tokens.issue).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("queues nothing when the registration window has closed", async () => {
    const { service, tx } = build({ issued: null });

    expect(await service.resend(resendRequest)).toEqual({ accepted: true });

    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("runs under the response timing floor", async () => {
    const { service, timing } = build();

    await service.resend(resendRequest);

    expect(timing.equalise).toHaveBeenCalledTimes(1);
  });
});
