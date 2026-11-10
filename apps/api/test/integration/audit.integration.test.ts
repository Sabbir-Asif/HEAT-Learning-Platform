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
      headers: response.headers,
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
    });
    expect(row?.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(row?.requestId).not.toBe("req-123");
    expect(reply.headers.get("x-request-id")).toBe(row?.requestId);
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
    expect(rows[1]?.requestId).toMatch(/^[0-9a-f-]{36}$/);
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

  describe("GET /admin/audit-log", () => {
    interface Page {
      items: { action: string; actorEmail: string | null; entity: string; occurredAt: string }[];
      total: number;
    }

    const seed = async () => {
      const root = await signedIn("SUPER_ADMIN");
      const other = await testApp().factories.user({ role: "ADMIN" });
      const prisma = testApp().database.prisma;
      await prisma.auditLog.createMany({
        data: [
          {
            actorId: other.id,
            action: "course.update",
            entity: "Course",
            occurredAt: new Date("2026-10-01T10:00:00.000Z"),
          },
          {
            actorId: other.id,
            action: "course.publish",
            entity: "Course",
            occurredAt: new Date("2026-10-02T18:30:00.000Z"),
          },
          {
            actorId: root.user.id,
            action: "admin.deactivate",
            entity: "User",
            occurredAt: new Date("2026-10-03T10:00:00.000Z"),
          },
        ],
      });
      return { root, other };
    };

    const list = async (cookie: string, query = "") =>
      call("GET", `/admin/audit-log${query}`, { cookie });

    test("only the super admin can read it", async () => {
      const plain = await signedIn("ADMIN");

      expect((await call("GET", "/admin/audit-log", { cookie: plain.cookie })).status).toBe(403);
      expect((await call("GET", "/admin/audit-log")).status).toBe(401);
    });

    test("lists newest first with the actor email and paginates", async () => {
      const { root, other } = await seed();

      const reply = await list(root.cookie, "?pageSize=10");
      const body = reply.body as Page;

      expect(reply.status).toBe(200);
      expect(body.total).toBe(4);
      expect(body.items[0]?.action).toBe("admin.sign-in");
      expect(body.items.map((item) => item.action).slice(1)).toEqual([
        "admin.deactivate",
        "course.publish",
        "course.update",
      ]);
      expect(body.items.find((item) => item.action === "course.update")?.actorEmail).toBe(
        other.email,
      );
      const second = (await list(root.cookie, "?pageSize=10&page=2")).body as Page;
      expect(second.items).toHaveLength(0);
    });

    test("filters by actor, action, entity and date range in Asia/Dhaka days", async () => {
      const { root, other } = await seed();

      const byActor = (await list(root.cookie, `?actor=${other.email.toUpperCase()}`)).body as Page;
      expect(byActor.items.map((item) => item.action).sort()).toEqual([
        "course.publish",
        "course.update",
      ]);

      const byAction = (await list(root.cookie, "?action=PUBLISH")).body as Page;
      expect(byAction.items.map((item) => item.action)).toEqual(["course.publish"]);

      const byEntity = (await list(root.cookie, "?entity=user&from=2026-10-03&to=2026-10-03"))
        .body as Page;
      expect(byEntity.items.map((item) => item.action)).toEqual(["admin.deactivate"]);

      const range = (await list(root.cookie, "?from=2026-10-03&to=2026-10-03")).body as Page;
      expect(range.items.map((item) => item.action)).toEqual([
        "admin.deactivate",
        "course.publish",
      ]);

      const utcDay = (await list(root.cookie, "?from=2026-10-02&to=2026-10-02")).body as Page;
      expect(utcDay.total).toBe(0);
    });

    test("rejects a malformed date and a reversed range", async () => {
      const { root } = await seed();

      expect((await list(root.cookie, "?from=yesterday")).status).toBe(400);
      expect((await list(root.cookie, "?from=2026-10-05&to=2026-10-01")).status).toBe(400);
    });

    test("reading the log is not audited", async () => {
      const { root } = await seed();
      const before = await testApp().database.prisma.auditLog.count();

      await list(root.cookie);

      expect(await testApp().database.prisma.auditLog.count()).toBe(before);
    });
  });
});
