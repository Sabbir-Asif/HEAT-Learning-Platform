import { afterAll, describe, expect, test, vi } from "vitest";
import { PasswordService, SessionService } from "../../src/auth";
import { CliModule } from "../../src/cli/cli.module";
import { RecoverSuperAdminService, RecoveryError } from "../../src/cli/recover-super-admin.service";
import { SignInLockout } from "../../src/rate-limit";
import { applyEnvironment } from "../support/auth-env";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const oldPassword = "correct horse battery staple";

describe("break-glass super admin recovery", () => {
  const restoreEnvironment = applyEnvironment({ LOCKOUT_THRESHOLD: "3" });
  afterAll(restoreEnvironment);
  const testApp = useTestApp({ imports: [CliModule] });

  const service = () => testApp().moduleRef.get(RecoverSuperAdminService, { strict: false });

  const superAdmin = async (email?: string) => {
    const user = await testApp().factories.user({
      role: "SUPER_ADMIN",
      ...(email ? { email } : {}),
    });
    return testApp().database.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await testApp().moduleRef.get(PasswordService).hash(oldPassword),
        mustChangePassword: false,
      },
    });
  };

  const signIn = async (email: string, password: string) => {
    const response = await fetch(`${testApp().baseUrl}/api/admin/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json", ...csrfHeaders(undefined) },
      body: JSON.stringify({ email, password }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { user?: { mustChangePassword: boolean } },
    };
  };

  test("the temporary password signs in and forces a password change", async () => {
    const admin = await superAdmin();

    const result = await service().recover({ hostname: "vps-1" });

    expect(result.email).toBe(admin.email);
    expect((await signIn(admin.email, oldPassword)).status).toBe(401);
    const reply = await signIn(admin.email, result.temporaryPassword);
    expect(reply.status).toBe(200);
    expect(reply.body.user?.mustChangePassword).toBe(true);
  });

  test("every temporary password is different and strong", async () => {
    await superAdmin();

    const first = await service().recover({ hostname: "vps-1" });
    const second = await service().recover({ hostname: "vps-1" });

    expect(first.temporaryPassword).not.toBe(second.temporaryPassword);
    expect(first.temporaryPassword.length).toBeGreaterThanOrEqual(24);
  });

  test("old sessions fail to refresh and are revoked", async () => {
    const admin = await superAdmin();
    const sessions = testApp().moduleRef.get(SessionService);
    const tokens = await sessions.create(admin.id, "admin");

    await service().recover({ hostname: "vps-1" });

    await expect(sessions.refresh(tokens.refreshToken, "admin")).rejects.toThrow();
    const rows = await testApp().database.prisma.session.findMany({ where: { userId: admin.id } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  test("an audit entry records timestamp and host without any secret", async () => {
    const admin = await superAdmin();

    const result = await service().recover({ hostname: "vps-1" });

    const rows = await testApp().database.prisma.auditLog.findMany({
      where: { action: "admin.break-glass.recover" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entity: "User",
      entityId: admin.id,
      actorId: null,
      after: { host: "vps-1" },
    });
    expect(rows[0]?.occurredAt).toBeInstanceOf(Date);
    const serialised = JSON.stringify(rows[0]);
    expect(serialised).not.toContain(result.temporaryPassword);
    expect(serialised).not.toContain("argon2");
  });

  test("the audit entry and the password change commit together", async () => {
    await superAdmin();
    const prisma = testApp().database.prisma;
    const before = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    await prisma.$executeRawUnsafe(
      `create or replace function reject_audit() returns trigger as $$ begin raise exception 'blocked'; end; $$ language plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `create trigger reject_audit_insert before insert on "AuditLog" for each row execute function reject_audit()`,
    );

    await expect(service().recover({ hostname: "vps-1" })).rejects.toThrow();

    const after = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN" } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("refuses when no super admin exists", async () => {
    await testApp().factories.user({ role: "ADMIN" });

    await expect(service().recover({ hostname: "vps-1" })).rejects.toThrow(RecoveryError);
  });

  test("refuses several super admins unless an email selects one", async () => {
    const first = await superAdmin("first@example.test");
    const second = await superAdmin("second@example.test");

    await expect(service().recover({ hostname: "vps-1" })).rejects.toThrow(/--email/);
    const untouched = await testApp().database.prisma.user.findFirstOrThrow({
      where: { id: first.id },
    });
    expect(untouched.passwordHash).toBe(first.passwordHash);

    const result = await service().recover({ hostname: "vps-1", email: "SECOND@example.test" });
    expect(result.email).toBe(second.email);
    const changed = await testApp().database.prisma.user.findFirstOrThrow({
      where: { id: second.id },
    });
    expect(changed.passwordHash).not.toBe(second.passwordHash);
    expect(changed.mustChangePassword).toBe(true);
  });

  test("refuses an email that is not a super admin", async () => {
    await superAdmin("root@example.test");
    const admin = await testApp().factories.user({ role: "ADMIN" });

    await expect(service().recover({ hostname: "vps-1", email: admin.email })).rejects.toThrow(
      RecoveryError,
    );
  });

  test("recovery clears the sign-in lockout so the temporary password works", async () => {
    const admin = await superAdmin();
    for (const attempt of ["a", "b", "c"]) await signIn(admin.email, attempt);
    expect((await signIn(admin.email, oldPassword)).status).toBe(429);

    const result = await service().recover({ hostname: "vps-1" });

    expect(result.lockoutCleared).toBe(true);
    expect((await signIn(admin.email, result.temporaryPassword)).status).toBe(200);
  });

  test("a lockout store failure does not undo the recovery", async () => {
    const admin = await superAdmin();
    const lockout = testApp().moduleRef.get(SignInLockout, { strict: false });
    vi.spyOn(lockout, "clearAccount").mockRejectedValueOnce(new Error("redis down"));

    const result = await service().recover({ hostname: "vps-1" });

    expect(result.lockoutCleared).toBe(false);
    const changed = await testApp().database.prisma.user.findFirstOrThrow({
      where: { id: admin.id },
    });
    expect(changed.passwordHash).not.toBe(admin.passwordHash);
  });

  test("when revocation fails nothing is committed and no audit row exists", async () => {
    const admin = await superAdmin();
    const sessions = testApp().moduleRef.get(SessionService);
    vi.spyOn(sessions, "revokeAll").mockRejectedValueOnce(new Error("db down"));

    await expect(service().recover({ hostname: "vps-1" })).rejects.toThrow();

    const unchanged = await testApp().database.prisma.user.findFirstOrThrow({
      where: { id: admin.id },
    });
    expect(unchanged.passwordHash).toBe(admin.passwordHash);
    const rows = await testApp().database.prisma.auditLog.findMany({
      where: { action: "admin.break-glass.recover" },
    });
    expect(rows).toHaveLength(0);
  });
});
