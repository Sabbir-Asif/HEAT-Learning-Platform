import { describe, expect, test } from "vitest";
import {
  ALREADY_REGISTERED_EVENT_TYPE,
  ALREADY_REGISTERED_TEMPLATE_KEY,
  RegistrationPolicyService,
  ResponseTiming,
  VerificationSessionService,
} from "../../src/account-protection";
import { SessionService, hashOpaqueToken } from "../../src/auth";
import { useTestApp } from "../support/testing-module";

const actor = { actorId: null, ipAddress: "203.0.113.9", requestId: "req-1" };
const timingToleranceMs = 150;
const timingFloorMs = 250;

describe("account protections on real Postgres", () => {
  const testApp = useTestApp();
  const prisma = () => testApp().database.prisma;
  const policy = () => testApp().moduleRef.get(RegistrationPolicyService);
  const verification = () => testApp().moduleRef.get(VerificationSessionService);
  const sessions = () => testApp().moduleRef.get(SessionService);

  const register = (email: string, emailVerifiedAt: Date | null = null) =>
    prisma().$transaction(async (tx) => {
      const outcome = await policy().apply(tx, email, actor);
      if (outcome.kind === "PROCEED") {
        await tx.user.create({
          data: { email, passwordHash: "hash", role: "STUDENT", realm: "STUDENT", emailVerifiedAt },
        });
      }
      return outcome;
    });

  const verifyToken = (userId: string, token: string) =>
    prisma().authToken.create({
      data: {
        userId,
        purpose: "VERIFY_EMAIL",
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

  test("an unverified account is replaced, its link dies and its sessions are revoked", async () => {
    const old = await testApp().factories.user({ email: "new@example.test", verified: false });
    await verifyToken(old.id, "old-link");
    const tokens = await sessions().create(old.id, "student");

    const outcome = await register("NEW@example.test");

    expect(outcome).toEqual({ kind: "PROCEED", replacedUserId: old.id });
    const replaced = await prisma()
      .$includingDeleted()
      .user.findUniqueOrThrow({ where: { id: old.id } });
    expect(replaced.deletedAt).not.toBeNull();
    const link = await prisma().authToken.findUniqueOrThrow({
      where: { tokenHash: hashOpaqueToken("old-link") },
    });
    expect(link.usedAt).not.toBeNull();
    await expect(sessions().authenticate(tokens.accessToken, "student")).rejects.toBeDefined();
    await expect(sessions().refresh(tokens.refreshToken, "student")).rejects.toBeDefined();
    const active = await prisma().user.findMany({
      where: { email: { equals: "new@example.test", mode: "insensitive" }, deletedAt: null },
    });
    expect(active).toHaveLength(1);
    expect(active[0]?.id).not.toBe(old.id);
    const audit = await prisma().auditLog.findMany({
      where: { action: "student.registration.replaced", entityId: old.id },
    });
    expect(audit).toHaveLength(1);
  });

  test("parallel registrations of one email serialise: one creates the user, the other gets the duplicate outcome", async () => {
    const results = await Promise.all([
      register("race@example.test", new Date()),
      register("RACE@example.test", new Date()),
    ]);

    expect(results.map((outcome) => outcome.kind).sort()).toEqual([
      "ALREADY_REGISTERED",
      "PROCEED",
    ]);
    expect(
      await prisma().user.count({
        where: { email: { equals: "race@example.test", mode: "insensitive" }, deletedAt: null },
      }),
    ).toBe(1);
  });

  test("parallel registrations over one unverified account each replace the previous unverified account and leave one active", async () => {
    const old = await testApp().factories.user({ email: "raceold@example.test", verified: false });

    const results = await Promise.all([
      register("raceold@example.test"),
      register("raceold@example.test"),
    ]);

    expect(results.map((outcome) => outcome.kind)).toEqual(["PROCEED", "PROCEED"]);
    expect(
      await prisma().user.count({
        where: { email: "raceold@example.test", deletedAt: null },
      }),
    ).toBe(1);
    const audit = await prisma().auditLog.findMany({
      where: { action: "student.registration.replaced", entityId: old.id },
    });
    expect(audit).toHaveLength(1);
  });

  test("a verified account yields the duplicate outcome and an Outbox row without secrets or address", async () => {
    const existing = await testApp().factories.user({ email: "taken@example.test" });

    const outcome = await register("taken@example.test");

    expect(outcome).toEqual({ kind: "ALREADY_REGISTERED", userId: existing.id });
    const rows = await prisma().outbox.findMany({
      where: { eventType: ALREADY_REGISTERED_EVENT_TYPE },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toEqual({
      template: ALREADY_REGISTERED_TEMPLATE_KEY,
      userId: existing.id,
    });
    expect(JSON.stringify(rows[0]?.payload)).not.toContain("taken@example.test");
    const untouched = await prisma().user.findUniqueOrThrow({ where: { id: existing.id } });
    expect(untouched.deletedAt).toBeNull();
    expect(await prisma().user.count({ where: { email: "taken@example.test" } })).toBe(1);
  });

  test("an unverified admin invitee is never replaced by a registration", async () => {
    const invitee = await testApp().factories.admin({
      email: "invitee@example.test",
      verified: false,
    });

    const outcome = await register("invitee@example.test");

    expect(outcome.kind).toBe("ALREADY_REGISTERED");
    const row = await prisma().user.findUniqueOrThrow({ where: { id: invitee.id } });
    expect(row.deletedAt).toBeNull();
  });

  test("a rejected (soft-deleted) account frees the email and no Outbox row is written", async () => {
    const rejected = await testApp().factories.user({ email: "freed@example.test" });
    await prisma().user.update({ where: { id: rejected.id }, data: { deletedAt: new Date() } });

    const outcome = await register("freed@example.test");

    expect(outcome).toEqual({ kind: "PROCEED", replacedUserId: null });
    expect(await prisma().outbox.count()).toBe(0);
    expect(
      await prisma().user.count({ where: { email: "freed@example.test", deletedAt: null } }),
    ).toBe(1);
  });

  test("verification revokes every session created before it and a fresh session works", async () => {
    const user = await testApp().factories.user({ verified: false });
    const early = await sessions().create(user.id, "student");
    const other = await sessions().create(user.id, "student");
    const rotated = await sessions().refresh(other.refreshToken, "student");
    await new Promise((resolve) => setTimeout(resolve, 20));
    const verifiedAt = new Date();
    await prisma().user.update({ where: { id: user.id }, data: { emailVerifiedAt: verifiedAt } });

    await verification().revokeSessionsBeforeVerification(user.id, verifiedAt);
    const fresh = await verification().issueFreshSession(user.id);

    await expect(sessions().authenticate(early.accessToken, "student")).rejects.toBeDefined();
    await expect(sessions().refresh(early.refreshToken, "student")).rejects.toBeDefined();
    await expect(sessions().authenticate(rotated.accessToken, "student")).rejects.toBeDefined();
    await expect(sessions().refresh(rotated.refreshToken, "student")).rejects.toBeDefined();
    await expect(sessions().authenticate(fresh.accessToken, "student")).resolves.toMatchObject({
      userId: user.id,
    });
    expect(fresh.familyId).not.toBe(early.familyId);
  });

  test("revocation inside the caller's transaction rolls back with it", async () => {
    const user = await testApp().factories.user({ verified: false });
    const early = await sessions().create(user.id, "student");
    const verifiedAt = new Date(Date.now() + 1000);

    await expect(
      prisma().$transaction(async (tx) => {
        await verification().revokeSessionsBeforeVerification(user.id, verifiedAt, tx);
        throw new Error("abort");
      }),
    ).rejects.toThrow("abort");

    await expect(sessions().authenticate(early.accessToken, "student")).resolves.toBeDefined();
  });

  test("new and existing email paths take the same time within the tolerance", async () => {
    await testApp().factories.user({ email: "present@example.test" });
    const timing = testApp().moduleRef.get(ResponseTiming);
    const measure = async (email: string): Promise<number> => {
      const started = performance.now();
      await timing.equalise(() => register(email), { floorMs: timingFloorMs });
      return performance.now() - started;
    };

    const fresh = await measure("brand-new@example.test");
    const duplicate = await measure("present@example.test");

    expect(Math.abs(fresh - duplicate)).toBeLessThan(timingToleranceMs);
    expect(Math.min(fresh, duplicate)).toBeGreaterThanOrEqual(timingFloorMs - 5);
  });
});
