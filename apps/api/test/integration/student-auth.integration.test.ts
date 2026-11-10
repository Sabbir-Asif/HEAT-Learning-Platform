import { hash as argonHash, argon2id } from "argon2";
import { describe, expect, test, vi } from "vitest";
import { PasswordService, SessionService, realmCookies } from "../../src/auth";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

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

describe("student sign-in, refresh, sign-out and /me", () => {
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
    };
  };

  const signIn = (email: string, secret: string = password) =>
    call("POST", "/auth/sign-in", { body: { email, password: secret } });

  const studentWithPassword = async (
    options: { verified?: boolean; digest?: string } = {},
  ): Promise<{ id: string; email: string }> => {
    const { user } = await testApp().factories.student({ verified: options.verified });
    const digest =
      options.digest ?? (await testApp().moduleRef.get(PasswordService).hash(password));
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: digest },
    });
    return { id: user.id, email: user.email };
  };

  const errorOf = (reply: Reply) =>
    (reply.body as { error: { code: string; message: string } }).error;

  test("correct credentials set both cookies and return the signed-in profile", async () => {
    const student = await studentWithPassword();

    const reply = await signIn(student.email);

    expect(reply.status).toBe(200);
    const access = reply.setCookies.find((line) => line.startsWith(realmCookies.student.access));
    const refresh = reply.setCookies.find((line) => line.startsWith(realmCookies.student.refresh));
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/Secure/i);
    expect(access).toMatch(/Path=\/(;|$)/);
    expect(refresh).toMatch(/Path=\/api\/auth\/refresh/);
    expect(refresh).toMatch(/SameSite=Strict/i);
    expect(reply.body).toMatchObject({
      user: { id: student.id, email: student.email, role: "STUDENT", emailVerified: true },
      enrollments: [],
    });
    expect(JSON.stringify(reply.body)).not.toMatch(/passwordHash|accessToken|refreshToken/);
  });

  test("the email is matched regardless of case and surrounding spaces", async () => {
    const student = await studentWithPassword();

    const reply = await signIn(`  ${student.email.toUpperCase()} `);

    expect(reply.status).toBe(200);
  });

  test("/me returns the enrollments with status and the decision reason", async () => {
    const student = await studentWithPassword();
    const { prisma } = testApp().database;
    const factories = testApp().factories;
    const open = await factories.course({ title: "Open course", slug: "open-course" });
    const refused = await factories.course({ title: "Refused course", slug: "refused-course" });
    const waiting = await factories.course({ title: "Waiting course", slug: "waiting-course" });
    await factories.enrollment({
      userId: student.id,
      courseId: open.course.id,
      status: "COMPLETED",
    });
    const rejected = await factories.enrollment({
      userId: student.id,
      courseId: refused.course.id,
      status: "REJECTED",
    });
    await factories.enrollment({ userId: student.id, courseId: waiting.course.id });
    const admin = await factories.admin();
    await prisma.enrollmentDecision.create({
      data: {
        enrollmentId: rejected.id,
        adminId: admin.id,
        action: "REJECT",
        reason: "Not a University of Dhaka student",
      },
    });

    const session = await signIn(student.email);
    const me = await call("GET", "/me", { cookie: cookieHeader(session.setCookies) });

    expect(me.status).toBe(200);
    const body = me.body as { enrollments: Array<Record<string, unknown>> };
    expect(body.enrollments).toEqual([
      {
        courseId: open.course.id,
        courseSlug: "open-course",
        courseTitle: "Open course",
        status: "COMPLETED",
      },
      {
        courseId: refused.course.id,
        courseSlug: "refused-course",
        courseTitle: "Refused course",
        status: "REJECTED",
        reason: "Not a University of Dhaka student",
      },
      {
        courseId: waiting.course.id,
        courseSlug: "waiting-course",
        courseTitle: "Waiting course",
        status: "PENDING_APPROVAL",
      },
    ]);
  });

  test("a pending student with an unverified email can sign in", async () => {
    const student = await studentWithPassword({ verified: false });

    const reply = await signIn(student.email);

    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ user: { emailVerified: false } });
  });

  test("wrong password and unknown email are indistinguishable and both verify a digest", async () => {
    const student = await studentWithPassword();
    const verify = vi.spyOn(testApp().moduleRef.get(PasswordService), "verify");

    const wrong = await signIn(student.email, "not the password");
    const unknown = await signIn("nobody@example.test");

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(errorOf(wrong)).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(errorOf(unknown).code).toBe(errorOf(wrong).code);
    expect(errorOf(unknown).message).toBe(errorOf(wrong).message);
    expect(wrong.setCookies).toEqual([]);
    expect(unknown.setCookies).toEqual([]);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(verify.mock.calls[1]?.[0]).toMatch(/^\$argon2id\$/);
  });

  test("a soft-deleted, deactivated or admin account gets the same generic error", async () => {
    const rejected = await studentWithPassword();
    await testApp().database.prisma
      .$executeRaw`UPDATE "User" SET "deletedAt" = now() WHERE id = ${rejected.id}::uuid`;
    const deactivated = await studentWithPassword();
    await testApp().database.prisma.user.update({
      where: { id: deactivated.id },
      data: { deactivatedAt: new Date() },
    });
    const admin = await testApp().factories.admin();
    await testApp().database.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    const baseline = await signIn("nobody@example.test");

    for (const email of [rejected.email, deactivated.email, admin.email]) {
      const reply = await signIn(email);

      expect(reply.status).toBe(401);
      expect(errorOf(reply)).toEqual({
        ...errorOf(baseline),
        requestId: expect.any(String),
      });
      expect(reply.setCookies).toEqual([]);
    }
  });

  test("an invalid email format is a validation error, not a credential error", async () => {
    const reply = await signIn("not-an-email");

    expect(reply.status).toBe(400);
    expect(errorOf(reply).code).toBe("VALIDATION_FAILED");
  });

  test("a digest with weaker parameters is upgraded on sign-in", async () => {
    const weak = await argonHash(password, {
      type: argon2id,
      memoryCost: 16,
      timeCost: 1,
      parallelism: 1,
    });
    const student = await studentWithPassword({ digest: weak });

    const reply = await signIn(student.email);

    expect(reply.status).toBe(200);
    const stored = await testApp().database.prisma.user.findUniqueOrThrow({
      where: { id: student.id },
    });
    expect(stored.passwordHash).not.toBe(weak);
    expect(testApp().moduleRef.get(PasswordService).needsRehash(stored.passwordHash)).toBe(false);
    expect((await signIn(student.email)).status).toBe(200);
  });

  test("refresh rotates the cookies and keeps the session alive", async () => {
    const student = await studentWithPassword();
    const first = await signIn(student.email);
    const refreshCookie = `${realmCookies.student.refresh}=${valueOf(first.setCookies, realmCookies.student.refresh)}`;

    const second = await call("POST", "/auth/refresh", { cookie: refreshCookie });

    expect(second.status).toBe(204);
    expect(valueOf(second.setCookies, realmCookies.student.refresh)).not.toBe(
      valueOf(first.setCookies, realmCookies.student.refresh),
    );
    const me = await call("GET", "/me", { cookie: cookieHeader(second.setCookies) });
    expect(me.status).toBe(200);
  });

  test("refresh without a cookie or with a bad cookie is 401 and clears the cookies", async () => {
    const missing = await call("POST", "/auth/refresh");
    const bad = await call("POST", "/auth/refresh", {
      cookie: `${realmCookies.student.refresh}=not-a-real-token`,
    });

    expect(missing.status).toBe(401);
    expect(bad.status).toBe(401);
    expect(errorOf(bad).code).toBe("UNAUTHENTICATED");
    expect(
      bad.setCookies.some((line) => line.startsWith(`${realmCookies.student.refresh}=;`)),
    ).toBe(true);
  });

  test("sign-out revokes the session on the server and clears both cookies", async () => {
    const student = await studentWithPassword();
    const session = await signIn(student.email);
    const cookie = cookieHeader(session.setCookies);

    const out = await call("POST", "/auth/sign-out", { cookie });

    expect(out.status).toBe(204);
    expect(out.setCookies.some((line) => line.startsWith(`${realmCookies.student.access}=;`))).toBe(
      true,
    );
    expect(
      out.setCookies.some((line) => line.startsWith(`${realmCookies.student.refresh}=;`)),
    ).toBe(true);
    expect((await call("GET", "/me", { cookie })).status).toBe(401);
    expect((await call("POST", "/auth/refresh", { cookie })).status).toBe(401);
    const rows = await testApp().database.prisma.session.findMany({
      where: { userId: student.id },
    });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  test("sign-out without a session is 401", async () => {
    expect((await call("POST", "/auth/sign-out")).status).toBe(401);
  });

  test("/me rejects a missing cookie and an admin-realm token", async () => {
    const admin = await testApp().factories.admin();
    const tokens = await testApp().moduleRef.get(SessionService).create(admin.id, "admin");

    const anonymous = await call("GET", "/me");
    const adminToken = await call("GET", "/me", {
      cookie: `${realmCookies.student.access}=${tokens.accessToken}`,
    });

    expect(anonymous.status).toBe(401);
    expect(adminToken.status).toBe(401);
  });
});
