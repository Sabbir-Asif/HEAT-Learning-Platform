import { describe, expect, test } from "vitest";
import { PasswordService } from "../../src/auth";
import { AuditModule } from "../../src/audit";
import { CoreModule } from "../../src/core";
import { AuditProbeController } from "../support/audit-probe.controller";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

describe("audit interceptor and audit log viewer", () => {
  const testApp = useTestApp({
    imports: [CoreModule, AuditModule],
    controllers: [AuditProbeController],
  });

  const call = async (
    method: "GET" | "POST",
    path: string,
    options: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method,
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...csrfHeaders(options.cookie),
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text === "" ? undefined : (JSON.parse(text) as unknown),
      setCookies: response.headers.getSetCookie(),
    };
  };

  const signedIn = async (role: "ADMIN" | "SUPER_ADMIN") => {
    const user = await testApp().factories.user({ role });
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    const reply = await call("POST", "/admin/auth/sign-in", {
      body: { email: user.email, password },
    });
    return { user, cookie: cookieHeader(reply.setCookies) };
  };

  const auditRows = (entity?: string) =>
    testApp().database.prisma.auditLog.findMany({
      where: entity === undefined ? {} : { entity },
      orderBy: { occurredAt: "asc" },
    });

  test("a successful audited admin mutation writes one row with redacted before and after, request id and IP", async () => {
    const admin = await signedIn("ADMIN");
    const target = await testApp().factories.user({ role: "STUDENT" });

    const reply = await call("POST", `/probe/audited/${target.id}`, {
      cookie: admin.cookie,
      body: {},
      headers: { "x-request-id": "req-123" },
    });

    expect(reply.status).toBe(200);
    const rows = await auditRows("User");
    const row = rows.find((candidate) => candidate.action === "probe.update");
    expect(rows.filter((candidate) => candidate.action === "probe.update")).toHaveLength(1);
    expect(row).toMatchObject({
      actorId: admin.user.id,
      entityId: target.id,
      requestId: "req-123",
    });
    expect(row?.ipAddress).toBeTruthy();
    expect(row?.before).toMatchObject({ mustChangePassword: false, passwordHash: "[REDACTED]" });
    expect(row?.after).toMatchObject({ mustChangePassword: true, passwordHash: "[REDACTED]" });
    expect(JSON.stringify(row)).not.toContain("argon2");
  });

  test("a change that rolls back leaves no audit row and no change", async () => {
    const admin = await signedIn("ADMIN");
    const target = await testApp().factories.user({ role: "STUDENT" });

    const reply = await call("POST", `/probe/audited/${target.id}`, {
      cookie: admin.cookie,
      body: { fail: true },
    });

    expect(reply.status).toBe(500);
    expect((await auditRows("User")).filter((row) => row.action === "probe.update")).toHaveLength(
      0,
    );
    const stored = await testApp().database.prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    expect(stored.mustChangePassword).toBe(false);
  });

  test("a handler that captures nothing still gets a row for the route entity", async () => {
    const admin = await signedIn("ADMIN");
    const target = await testApp().factories.user({ role: "STUDENT" });

    await call("POST", `/probe/audited/${target.id}`, {
      cookie: admin.cookie,
      body: { silent: true },
    });

    const row = (await auditRows("User")).find((candidate) => candidate.action === "probe.update");
    expect(row).toMatchObject({ entityId: target.id, actorId: admin.user.id });
    expect(row?.before).toBeNull();
  });

  test("an audit row cannot be updated, deleted or truncated", async () => {
    const prisma = testApp().database.prisma;
    await prisma.auditLog.create({ data: { action: "seed", entity: "User" } });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET "action" = 'x'`),
    ).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "AuditLog"`)).rejects.toThrow();
    expect(await prisma.auditLog.count()).toBe(1);
  });

  test("admin sign-in, sign-out and password change are audited without secrets", async () => {
    const admin = await signedIn("ADMIN");

    const changed = await call("POST", "/admin/account/change-password", {
      cookie: admin.cookie,
      body: { currentPassword: password, newPassword: "an entirely different passphrase" },
      headers: { "x-request-id": "req-pw" },
    });
    const out = await call("POST", "/admin/auth/sign-out", { cookie: admin.cookie });

    expect(changed.status).toBe(204);
    expect(out.status).toBe(204);
    const rows = await auditRows("User");
    expect(rows.map((row) => row.action)).toEqual([
      "admin.sign-in",
      "admin.password.change",
      "admin.sign-out",
    ]);
    expect(rows.every((row) => row.actorId === admin.user.id)).toBe(true);
    expect(rows[1]?.requestId).toBe("req-pw");
    const serialised = JSON.stringify(rows);
    expect(serialised).not.toContain("argon2");
    expect(serialised).not.toContain("passphrase");
  });

  test("a rejected password change writes no audit row", async () => {
    const admin = await signedIn("ADMIN");

    const reply = await call("POST", "/admin/account/change-password", {
      cookie: admin.cookie,
      body: {
        currentPassword: "wrong wrong wrong",
        newPassword: "an entirely different passphrase",
      },
    });

    expect(reply.status).toBe(400);
    expect((await auditRows("User")).map((row) => row.action)).toEqual(["admin.sign-in"]);
  });

  test("a failed sign-in writes no audit row", async () => {
    const user = await testApp().factories.user({ role: "ADMIN" });

    const reply = await call("POST", "/admin/auth/sign-in", {
      body: { email: user.email, password: "wrong wrong wrong" },
    });

    expect(reply.status).toBe(401);
    expect(await auditRows()).toHaveLength(0);
  });
});
