import { describe, expect, test, vi } from "vitest";
import { PasswordService, hashOpaqueToken } from "../../src/auth";
import { SecretBox } from "../../src/core";
import { BreachedPasswordProvider } from "../../src/auth/breached-password.provider";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";
const chosen = "a brand new long passphrase";

interface Reply {
  status: number;
  body: unknown;
  setCookies: string[];
  headers: { cacheControl: string | null };
}

interface Summary {
  id: string;
  email: string;
  role: string;
  status: string;
  inviteExpiresAt: string | null;
}

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

const errorCode = (reply: Reply): string => (reply.body as { error: { code: string } }).error.code;

interface InvitationPayload {
  template: string;
  userId: string;
  expiresAt: string;
  encryptedToken: string;
}

describe("admin invitations, deactivation and reactivation", () => {
  const testApp = useTestApp();

  const call = async (
    method: "GET" | "POST",
    path: string,
    options: { cookie?: string; body?: unknown } = {},
  ): Promise<Reply> => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method,
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...csrfHeaders(options.cookie),
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text === "" ? undefined : (JSON.parse(text) as unknown),
      setCookies: response.headers.getSetCookie(),
      headers: { cacheControl: response.headers.get("cache-control") },
    };
  };

  const stubBreachLookup = (body = ""): void => {
    vi.spyOn(testApp().moduleRef.get(BreachedPasswordProvider), "fetchRange").mockResolvedValue(
      body,
    );
  };

  const adminWithPassword = async (role: "ADMIN" | "SUPER_ADMIN") => {
    const user = await testApp().factories.user({ role });
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    return user;
  };

  const signIn = async (email: string, secret: string = password) =>
    call("POST", "/admin/auth/sign-in", { body: { email, password: secret } });

  const signedIn = async (role: "ADMIN" | "SUPER_ADMIN") => {
    const user = await adminWithPassword(role);
    const reply = await signIn(user.email);
    return { user, cookie: cookieHeader(reply.setCookies) };
  };

  const lookup = async (token: string) =>
    call("POST", "/admin/auth/invitations/lookup", { body: { token } });

  const invite = async (cookie: string, email: string) =>
    call("POST", "/admin/admins", { cookie, body: { email } });

  const outboxFor = async (userId: string) => {
    const rows = await testApp().database.prisma.outbox.findMany({
      where: { eventType: "admin.invitation.issued" },
      orderBy: { createdAt: "asc" },
    });
    return rows
      .map((row) => row.payload as unknown as InvitationPayload)
      .filter((payload) => payload.userId === userId);
  };

  const tokenFrom = (payload: InvitationPayload | undefined): string =>
    testApp()
      .moduleRef.get(SecretBox)
      .decrypt(payload?.encryptedToken ?? "");

  const invited = async (email = "new.admin@example.test") => {
    stubBreachLookup();
    const root = await signedIn("SUPER_ADMIN");
    const reply = await invite(root.cookie, email);
    const summary = reply.body as Summary;
    const [payload] = await outboxFor(summary.id);
    return { root, summary, token: tokenFrom(payload) };
  };

  test("only the super admin can list or invite, and a plain ADMIN is refused", async () => {
    const plain = await signedIn("ADMIN");

    expect((await call("GET", "/admin/admins", { cookie: plain.cookie })).status).toBe(403);
    expect((await invite(plain.cookie, "x@example.test")).status).toBe(403);
    expect((await call("GET", "/admin/admins")).status).toBe(401);
    expect(await testApp().database.prisma.outbox.count()).toBe(0);
  });

  test("inviting creates a pending ADMIN, a hashed single token, an outbox row and an audit entry", async () => {
    const root = await signedIn("SUPER_ADMIN");

    const reply = await invite(root.cookie, "  New.Admin@Example.test ");

    expect(reply.status).toBe(201);
    const summary = reply.body as Summary;
    expect(summary).toMatchObject({
      email: "new.admin@example.test",
      role: "ADMIN",
      status: "INVITED",
    });
    expect(JSON.stringify(reply.body)).not.toMatch(/token|passwordHash/i);
    const [payload] = await outboxFor(summary.id);
    expect(Object.keys(payload ?? {}).sort()).toEqual([
      "encryptedToken",
      "expiresAt",
      "template",
      "userId",
    ]);
    expect(payload?.template).toBe("admin-invitation");
    const token = tokenFrom(payload);
    expect(token).toMatch(/^[\w-]{43}$/);
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain(token);
    expect(serialised).not.toContain("new.admin@example.test");
    expect(serialised).not.toContain("accept-invite");
    const stored = await testApp().database.prisma.authToken.findMany({
      where: { userId: summary.id },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ purpose: "INVITE", usedAt: null });
    expect(stored[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored[0]?.tokenHash).toBe(hashOpaqueToken(token));
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: summary.id },
    });
    expect(audit).toMatchObject({
      actorId: root.user.id,
      action: "admin.invite",
      entity: "User",
    });
    expect((await signIn("new.admin@example.test", token)).status).toBe(401);
  });

  test("an email already used by any account cannot be invited", async () => {
    const root = await signedIn("SUPER_ADMIN");
    const { user: student } = await testApp().factories.student();
    const existingAdmin = await testApp().factories.admin();

    for (const email of [student.email, existingAdmin.email.toUpperCase(), root.user.email]) {
      const reply = await invite(root.cookie, email);
      expect(reply.status).toBe(409);
      expect(errorCode(reply)).toBe("EMAIL_IN_USE");
    }
    expect(await testApp().database.prisma.outbox.count()).toBe(0);
  });

  test("accepting sets the password without authenticator setup and the token cannot be reused", async () => {
    const { summary, token } = await invited();

    const looked = await lookup(token);
    expect(looked.headers.cacheControl).toBe("no-store");
    expect(looked.body).toEqual({ status: "VALID", email: "new.admin@example.test" });
    const accepted = await call("POST", "/admin/auth/invitations/accept", {
      body: { token, password: chosen },
    });

    expect(accepted.status).toBe(204);
    expect(accepted.headers.cacheControl).toBe("no-store");
    const session = await signIn("new.admin@example.test", chosen);
    expect(session.status).toBe(200);
    expect(session.body).toMatchObject({
      user: { id: summary.id, role: "ADMIN", mustChangePassword: false },
    });
    const reuse = await call("POST", "/admin/auth/invitations/accept", {
      body: { token, password: "another long passphrase here" },
    });
    expect(reuse.status).toBe(400);
    expect(errorCode(reuse)).toBe("INVITATION_INVALID");
    expect((await lookup(token)).body).toEqual({
      status: "INVALID",
    });
    expect((await signIn("new.admin@example.test", "another long passphrase here")).status).toBe(
      401,
    );
    const actions = (
      await testApp().database.prisma.auditLog.findMany({ where: { entityId: summary.id } })
    )
      .map((row) => row.action)
      .filter((action) => !action.startsWith("admin.sign-"));
    expect(actions.sort()).toEqual(["admin.invite", "admin.invite.accept"]);
  });

  test("two simultaneous acceptances consume the token once", async () => {
    const { token } = await invited();

    const replies = await Promise.all([
      call("POST", "/admin/auth/invitations/accept", { body: { token, password: chosen } }),
      call("POST", "/admin/auth/invitations/accept", {
        body: { token, password: "a second long passphrase" },
      }),
    ]);

    expect(replies.map((reply) => reply.status).sort()).toEqual([204, 400]);
  });

  test("an unknown token, a short password and a breached password are refused", async () => {
    const { token } = await invited();

    const unknown = await call("POST", "/admin/auth/invitations/accept", {
      body: { token: "nope", password: chosen },
    });
    expect(errorCode(unknown)).toBe("INVITATION_INVALID");
    const short = await call("POST", "/admin/auth/invitations/accept", {
      body: { token, password: "short" },
    });
    expect(errorCode(short)).toBe("VALIDATION_FAILED");
    vi.spyOn(testApp().moduleRef.get(BreachedPasswordProvider), "fetchRange").mockImplementation(
      async (prefix) => {
        const { createHash } = await import("node:crypto");
        const sha1 = createHash("sha1").update(chosen).digest("hex").toUpperCase();
        return prefix === sha1.slice(0, 5) ? `${sha1.slice(5)}:9` : "";
      },
    );
    const breached = await call("POST", "/admin/auth/invitations/accept", {
      body: { token, password: chosen },
    });
    expect(errorCode(breached)).toBe("PASSWORD_BREACHED");
    expect((await lookup(token)).body).toMatchObject({
      status: "VALID",
    });
  });

  test("an expired invitation says so, shows as expired in the list, and a resend issues a fresh one", async () => {
    const { root, summary, token } = await invited();
    await testApp().database.prisma.authToken.updateMany({
      where: { userId: summary.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await lookup(token)).body).toEqual({
      status: "EXPIRED",
    });
    const expired = await call("POST", "/admin/auth/invitations/accept", {
      body: { token, password: chosen },
    });
    expect(errorCode(expired)).toBe("INVITATION_EXPIRED");
    const listed = await call("GET", "/admin/admins", { cookie: root.cookie });
    expect(
      (listed.body as { items: Summary[] }).items.find((item) => item.id === summary.id)?.status,
    ).toBe("INVITE_EXPIRED");

    const resent = await call("POST", `/admin/admins/${summary.id}/resend-invitation`, {
      cookie: root.cookie,
    });
    expect(resent.status).toBe(200);
    expect((resent.body as Summary).status).toBe("INVITED");
    const payloads = await outboxFor(summary.id);
    expect(payloads).toHaveLength(2);
    const fresh = tokenFrom(payloads[1]);
    expect(fresh).not.toBe(token);
    expect((await lookup(token)).body).toEqual({
      status: "INVALID",
    });
    expect(
      (
        await call("POST", "/admin/auth/invitations/accept", {
          body: { token: fresh, password: chosen },
        })
      ).status,
    ).toBe(204);
  });

  test("an admin who already accepted has no invitation to resend", async () => {
    const { root, summary, token } = await invited();
    await call("POST", "/admin/auth/invitations/accept", { body: { token, password: chosen } });

    const reply = await call("POST", `/admin/admins/${summary.id}/resend-invitation`, {
      cookie: root.cookie,
    });

    expect(reply.status).toBe(409);
    expect(errorCode(reply)).toBe("INVITATION_NOT_PENDING");
  });

  test("deactivating revokes every session at once, and reactivating restores sign-in", async () => {
    const root = await signedIn("SUPER_ADMIN");
    const target = await adminWithPassword("ADMIN");
    const first = cookieHeader((await signIn(target.email)).setCookies);
    const second = await signIn(target.email);
    const secondCookie = cookieHeader(second.setCookies);
    expect((await call("GET", "/admin/me", { cookie: first })).status).toBe(200);

    const deactivated = await call("POST", `/admin/admins/${target.id}/deactivate`, {
      cookie: root.cookie,
    });

    expect(deactivated.status).toBe(200);
    expect((deactivated.body as Summary).status).toBe("DEACTIVATED");
    expect((await call("GET", "/admin/me", { cookie: first })).status).toBe(401);
    expect((await call("GET", "/admin/me", { cookie: secondCookie })).status).toBe(401);
    expect((await call("POST", "/admin/auth/refresh", { cookie: secondCookie })).status).toBe(401);
    const sessions = await testApp().database.prisma.session.findMany({
      where: { userId: target.id },
    });
    expect(sessions.every((row) => row.revokedAt !== null)).toBe(true);
    expect((await signIn(target.email)).status).toBe(401);

    const reactivated = await call("POST", `/admin/admins/${target.id}/reactivate`, {
      cookie: root.cookie,
    });
    expect((reactivated.body as Summary).status).toBe("ACTIVE");
    expect((await signIn(target.email)).status).toBe(200);
    expect((await call("GET", "/admin/me", { cookie: first })).status).toBe(401);
    const actions = (
      await testApp().database.prisma.auditLog.findMany({ where: { entityId: target.id } })
    )
      .map((row) => row.action)
      .filter((action) => !action.startsWith("admin.sign-"));
    expect(actions.sort()).toEqual(["admin.deactivate", "admin.reactivate"]);
    const reactivateAudit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: target.id, action: "admin.reactivate" },
    });
    expect(reactivateAudit).toMatchObject({
      before: { status: "DEACTIVATED" },
      after: { status: "ACTIVE" },
    });
  });

  test("the super admin cannot deactivate themselves or another super admin", async () => {
    const root = await signedIn("SUPER_ADMIN");
    const other = await testApp().factories.user({ role: "SUPER_ADMIN" });

    const self = await call("POST", `/admin/admins/${root.user.id}/deactivate`, {
      cookie: root.cookie,
    });
    const peer = await call("POST", `/admin/admins/${other.id}/deactivate`, {
      cookie: root.cookie,
    });

    expect(self.status).toBe(409);
    expect(errorCode(self)).toBe("CANNOT_DEACTIVATE_SELF");
    expect(peer.status).toBe(403);
    expect((await call("GET", "/admin/me", { cookie: root.cookie })).status).toBe(200);
  });

  test("a plain admin cannot deactivate anyone and students are not manageable", async () => {
    const plain = await signedIn("ADMIN");
    const other = await adminWithPassword("ADMIN");
    const root = await signedIn("SUPER_ADMIN");
    const { user: student } = await testApp().factories.student();

    const refused = await call("POST", `/admin/admins/${other.id}/deactivate`, {
      cookie: plain.cookie,
    });
    const missing = await call("POST", `/admin/admins/${student.id}/deactivate`, {
      cookie: root.cookie,
    });

    expect(refused.status).toBe(403);
    expect(missing.status).toBe(404);
  });

  test("the list pages, sorts and shows statuses without secrets", async () => {
    const root = await signedIn("SUPER_ADMIN");
    for (const name of ["b", "a", "c"])
      await testApp().factories.admin({ email: `${name}@x.test` });

    const reply = await call("GET", "/admin/admins?pageSize=10&sort=email", {
      cookie: root.cookie,
    });

    const body = reply.body as { items: Summary[]; total: number; page: number };
    expect(body.total).toBe(4);
    expect(body.items.map((item) => item.email)).toEqual(
      [root.user.email, "a@x.test", "b@x.test", "c@x.test"].sort(),
    );
    expect(JSON.stringify(reply.body)).not.toMatch(/passwordHash|tokenHash/);
    const second = await call("GET", "/admin/admins?pageSize=10&page=2", { cookie: root.cookie });
    expect((second.body as { items: Summary[] }).items).toEqual([]);
    expect((await call("GET", "/admin/admins?pageSize=7", { cookie: root.cookie })).status).toBe(
      400,
    );
  });
});
