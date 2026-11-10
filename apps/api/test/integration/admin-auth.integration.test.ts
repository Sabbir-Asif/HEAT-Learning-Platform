import { createHash } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { PasswordService, SessionService, realmCookies } from "../../src/auth";
import { BreachedPasswordProvider } from "../../src/auth/breached-password.provider";
import { AccessProbeController } from "../support/access-probe.controller";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";
const replacement = "a different long passphrase";

interface Reply {
  status: number;
  body: unknown;
  setCookies: string[];
}

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

const valueOf = (setCookies: string[], name: string): string | undefined =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const errorOf = (reply: Reply) =>
  (reply.body as { error: { code: string; message: string } }).error;

describe("admin sign-in, refresh, sign-out, /admin/me and change-password", () => {
  const testApp = useTestApp({ controllers: [AccessProbeController] });

  const call = async (
    method: "GET" | "POST",
    path: string,
    options: { cookie?: string; body?: unknown } = {},
  ): Promise<Reply> => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method,
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
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

  const adminSignIn = (email: string, secret: string = password) =>
    call("POST", "/admin/auth/sign-in", { body: { email, password: secret } });

  const stubBreachLookup = (body = ""): void => {
    vi.spyOn(testApp().moduleRef.get(BreachedPasswordProvider), "fetchRange").mockResolvedValue(
      body,
    );
  };

  const adminWithPassword = async (
    options: { role?: "ADMIN" | "SUPER_ADMIN"; mustChangePassword?: boolean } = {},
  ): Promise<{ id: string; email: string }> => {
    const user = await testApp().factories.user({ role: options.role ?? "ADMIN" });
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await testApp().moduleRef.get(PasswordService).hash(password),
        mustChangePassword: options.mustChangePassword ?? false,
      },
    });
    return { id: user.id, email: user.email };
  };

  const signedIn = async (
    options: Parameters<typeof adminWithPassword>[0] = {},
  ): Promise<{ id: string; email: string; cookie: string; reply: Reply }> => {
    const admin = await adminWithPassword(options);
    const reply = await adminSignIn(admin.email);
    return { ...admin, cookie: cookieHeader(reply.setCookies), reply };
  };

  test.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "a %s signs in, gets path-limited admin cookies and the profile",
    async (role) => {
      const admin = await adminWithPassword({ role });

      const reply = await adminSignIn(admin.email);

      expect(reply.status).toBe(200);
      const access = reply.setCookies.find((line) => line.startsWith(realmCookies.admin.access));
      const refresh = reply.setCookies.find((line) => line.startsWith(realmCookies.admin.refresh));
      expect(access).toMatch(/HttpOnly/i);
      expect(access).toMatch(/Path=\/(;|$)/);
      expect(refresh).toMatch(/Path=\/api\/admin\/auth\/refresh/);
      expect(refresh).toMatch(/SameSite=Strict/i);
      expect(reply.setCookies.some((line) => line.startsWith(realmCookies.student.access))).toBe(
        false,
      );
      expect(reply.body).toEqual({
        user: { id: admin.id, email: admin.email, role, mustChangePassword: false },
      });
      expect(JSON.stringify(reply.body)).not.toMatch(/passwordHash|accessToken|refreshToken/);
    },
  );

  test("the email is matched regardless of case and surrounding spaces", async () => {
    const admin = await adminWithPassword();

    expect((await adminSignIn(`  ${admin.email.toUpperCase()} `)).status).toBe(200);
  });

  test("student credentials are rejected on the admin endpoint", async () => {
    const { user } = await testApp().factories.student();
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });

    const reply = await adminSignIn(user.email);

    expect(reply.status).toBe(401);
    expect(errorOf(reply).code).toBe("INVALID_CREDENTIALS");
    expect(reply.setCookies).toEqual([]);
  });

  test("admin credentials are rejected on the student endpoint", async () => {
    const admin = await adminWithPassword();

    const reply = await call("POST", "/auth/sign-in", {
      body: { email: admin.email, password },
    });

    expect(reply.status).toBe(401);
    expect(errorOf(reply).code).toBe("INVALID_CREDENTIALS");
  });

  test("wrong password, unknown email, student, deleted and deactivated accounts are indistinguishable", async () => {
    const verify = vi.spyOn(testApp().moduleRef.get(PasswordService), "verify");
    const known = await adminWithPassword();
    const deleted = await adminWithPassword();
    await testApp().database.prisma
      .$executeRaw`UPDATE "User" SET "deletedAt" = now() WHERE id = ${deleted.id}::uuid`;
    const deactivated = await adminWithPassword();
    await testApp().database.prisma.user.update({
      where: { id: deactivated.id },
      data: { deactivatedAt: new Date() },
    });
    const { user: student } = await testApp().factories.student();
    await testApp().database.prisma.user.update({
      where: { id: student.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    const baseline = await adminSignIn("nobody@example.test");
    verify.mockClear();

    const replies = [
      await adminSignIn(known.email, "not the password"),
      await adminSignIn(deleted.email),
      await adminSignIn(deactivated.email),
      await adminSignIn(student.email),
    ];

    for (const reply of replies) {
      expect(reply.status).toBe(401);
      expect(errorOf(reply)).toEqual({ ...errorOf(baseline), requestId: expect.any(String) });
      expect(reply.setCookies).toEqual([]);
    }
    expect(verify).toHaveBeenCalledTimes(4);
    for (const call of verify.mock.calls) expect(call[0]).toMatch(/^\$argon2id\$/);
  });

  test("a deactivated admin cannot use an existing session either", async () => {
    const { id, cookie } = await signedIn();
    await testApp().database.prisma.user.update({
      where: { id },
      data: { deactivatedAt: new Date() },
    });

    expect((await call("GET", "/admin/me", { cookie })).status).toBe(401);
  });

  test("an invalid email format is a validation error", async () => {
    const reply = await adminSignIn("not-an-email");

    expect(reply.status).toBe(400);
    expect(errorOf(reply).code).toBe("VALIDATION_FAILED");
  });

  test("/admin/me returns the profile and rejects anonymous callers", async () => {
    const { id, email, cookie } = await signedIn({ role: "SUPER_ADMIN" });

    const me = await call("GET", "/admin/me", { cookie });
    const anonymous = await call("GET", "/admin/me");

    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      user: { id, email, role: "SUPER_ADMIN", mustChangePassword: false },
    });
    expect(anonymous.status).toBe(401);
  });

  test("a student cookie on an admin route is 403, and the student cookie name is not accepted", async () => {
    const { user } = await testApp().factories.student();
    const tokens = await testApp().moduleRef.get(SessionService).create(user.id, "student");

    const forbidden = await call("GET", "/admin/me", {
      cookie: `${realmCookies.student.access}=${tokens.accessToken}`,
    });
    const renamed = await call("GET", "/admin/me", {
      cookie: `${realmCookies.admin.access}=${tokens.accessToken}`,
    });

    expect(forbidden.status).toBe(403);
    expect(errorOf(forbidden).code).toBe("FORBIDDEN");
    expect(renamed.status).toBe(401);
  });

  test("an admin cookie on a student route is 403", async () => {
    const { cookie } = await signedIn();

    expect((await call("GET", "/me", { cookie })).status).toBe(403);
  });

  test("refresh rotates the admin cookies and keeps the session alive", async () => {
    const first = await signedIn();
    const refreshCookie = `${realmCookies.admin.refresh}=${valueOf(first.reply.setCookies, realmCookies.admin.refresh)}`;

    const second = await call("POST", "/admin/auth/refresh", { cookie: refreshCookie });

    expect(second.status).toBe(204);
    expect(valueOf(second.setCookies, realmCookies.admin.refresh)).not.toBe(
      valueOf(first.reply.setCookies, realmCookies.admin.refresh),
    );
    expect(
      (await call("GET", "/admin/me", { cookie: cookieHeader(second.setCookies) })).status,
    ).toBe(200);
  });

  test("refresh without a cookie or with a bad cookie is 401 and clears the cookies", async () => {
    const missing = await call("POST", "/admin/auth/refresh");
    const bad = await call("POST", "/admin/auth/refresh", {
      cookie: `${realmCookies.admin.refresh}=not-a-real-token`,
    });

    expect(missing.status).toBe(401);
    expect(bad.status).toBe(401);
    expect(bad.setCookies.some((line) => line.startsWith(`${realmCookies.admin.refresh}=;`))).toBe(
      true,
    );
  });

  test("refresh after more than 30 minutes without one is refused and ends the session", async () => {
    const { id, reply, cookie } = await signedIn();
    await testApp().database.prisma.session.updateMany({
      where: { userId: id },
      data: { createdAt: new Date(Date.now() - 31 * 60_000) },
    });

    const refreshed = await call("POST", "/admin/auth/refresh", {
      cookie: `${realmCookies.admin.refresh}=${valueOf(reply.setCookies, realmCookies.admin.refresh)}`,
    });

    expect(refreshed.status).toBe(401);
    expect(
      refreshed.setCookies.some((line) => line.startsWith(`${realmCookies.admin.refresh}=;`)),
    ).toBe(true);
    expect(
      refreshed.setCookies.some((line) => line.startsWith(`${realmCookies.admin.access}=;`)),
    ).toBe(true);
    expect((await call("GET", "/admin/me", { cookie })).status).toBe(401);
  });

  test("sign-out revokes the session and clears both cookies", async () => {
    const { id, cookie } = await signedIn();

    const out = await call("POST", "/admin/auth/sign-out", { cookie });

    expect(out.status).toBe(204);
    expect(out.setCookies.some((line) => line.startsWith(`${realmCookies.admin.access}=;`))).toBe(
      true,
    );
    expect(out.setCookies.some((line) => line.startsWith(`${realmCookies.admin.refresh}=;`))).toBe(
      true,
    );
    expect((await call("GET", "/admin/me", { cookie })).status).toBe(401);
    const rows = await testApp().database.prisma.session.findMany({ where: { userId: id } });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  test("sign-out without a session is 401", async () => {
    expect((await call("POST", "/admin/auth/sign-out")).status).toBe(401);
  });

  describe("mustChangePassword", () => {
    test("sign-in succeeds and reports the flag", async () => {
      const { reply } = await signedIn({ mustChangePassword: true });

      expect(reply.status).toBe(200);
      expect(reply.body).toMatchObject({ user: { mustChangePassword: true } });
    });

    test("only /admin/me, change-password and sign-out work; any other admin route is PASSWORD_CHANGE_REQUIRED", async () => {
      const { cookie } = await signedIn({ role: "SUPER_ADMIN", mustChangePassword: true });
      stubBreachLookup();

      const me = await call("GET", "/admin/me", { cookie });
      const blocked = await call("GET", "/probe/admin", { cookie });
      const change = await call("POST", "/admin/account/change-password", {
        cookie,
        body: { currentPassword: password, newPassword: replacement },
      });
      const out = await call("POST", "/admin/auth/sign-out", { cookie });

      expect(me.status).toBe(200);
      expect(blocked.status).toBe(403);
      expect(errorOf(blocked).code).toBe("PASSWORD_CHANGE_REQUIRED");
      expect(change.status).toBe(204);
      expect(out.status).toBe(204);
    });

    test("refresh still works while the change is pending", async () => {
      const { reply } = await signedIn({ mustChangePassword: true });

      const refreshed = await call("POST", "/admin/auth/refresh", {
        cookie: `${realmCookies.admin.refresh}=${valueOf(reply.setCookies, realmCookies.admin.refresh)}`,
      });

      expect(refreshed.status).toBe(204);
    });
  });

  describe("change-password", () => {
    const change = (cookie: string, body: unknown) =>
      call("POST", "/admin/account/change-password", { cookie, body });

    test("rehashes, clears the flag, keeps this session and revokes the others", async () => {
      stubBreachLookup();
      const first = await signedIn({ mustChangePassword: true });
      const other = await adminSignIn(first.email);
      const otherCookie = cookieHeader(other.setCookies);

      const reply = await change(first.cookie, {
        currentPassword: password,
        newPassword: replacement,
      });

      expect(reply.status).toBe(204);
      const stored = await testApp().database.prisma.user.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(stored.mustChangePassword).toBe(false);
      const passwords = testApp().moduleRef.get(PasswordService);
      expect(await passwords.verify(stored.passwordHash, replacement)).toBe(true);
      expect(passwords.needsRehash(stored.passwordHash)).toBe(false);
      expect((await call("GET", "/admin/me", { cookie: first.cookie })).body).toMatchObject({
        user: { mustChangePassword: false },
      });
      expect((await call("GET", "/probe/admin", { cookie: first.cookie })).status).toBe(200);
      expect((await call("GET", "/admin/me", { cookie: otherCookie })).status).toBe(401);
      expect((await adminSignIn(first.email, password)).status).toBe(401);
      expect((await adminSignIn(first.email, replacement)).status).toBe(200);
    });

    test("a wrong current password is refused and changes nothing", async () => {
      stubBreachLookup();
      const { id, cookie } = await signedIn({ mustChangePassword: true });
      const before = await testApp().database.prisma.user.findUniqueOrThrow({ where: { id } });

      const reply = await change(cookie, {
        currentPassword: "not the password",
        newPassword: replacement,
      });

      expect(reply.status).toBe(400);
      expect(errorOf(reply).code).toBe("INVALID_CREDENTIALS");
      const after = await testApp().database.prisma.user.findUniqueOrThrow({ where: { id } });
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.mustChangePassword).toBe(true);
    });

    test("a short new password is a validation error", async () => {
      const { cookie } = await signedIn({ mustChangePassword: true });

      const reply = await change(cookie, { currentPassword: password, newPassword: "short" });

      expect(reply.status).toBe(400);
      expect(errorOf(reply).code).toBe("VALIDATION_FAILED");
    });

    test("a new password equal to the current one is a validation error", async () => {
      const { cookie } = await signedIn({ mustChangePassword: true });

      const reply = await change(cookie, { currentPassword: password, newPassword: password });

      expect(reply.status).toBe(400);
      expect(errorOf(reply).code).toBe("VALIDATION_FAILED");
    });

    test("a breached new password is refused and the flag stays", async () => {
      const sha1 = createHash("sha1").update(replacement).digest("hex").toUpperCase();
      stubBreachLookup(`${sha1.slice(5)}:42\r\n`);
      const { id, cookie } = await signedIn({ mustChangePassword: true });

      const reply = await change(cookie, { currentPassword: password, newPassword: replacement });

      expect(reply.status).toBe(400);
      expect(errorOf(reply).code).toBe("PASSWORD_BREACHED");
      const stored = await testApp().database.prisma.user.findUniqueOrThrow({ where: { id } });
      expect(stored.mustChangePassword).toBe(true);
    });

    test("it needs an admin session", async () => {
      const anonymous = await call("POST", "/admin/account/change-password", {
        body: { currentPassword: password, newPassword: replacement },
      });
      const { user } = await testApp().factories.student();
      const tokens = await testApp().moduleRef.get(SessionService).create(user.id, "student");
      const student = await change(`${realmCookies.student.access}=${tokens.accessToken}`, {
        currentPassword: password,
        newPassword: replacement,
      });

      expect(anonymous.status).toBe(401);
      expect(student.status).toBe(403);
    });
  });
});
