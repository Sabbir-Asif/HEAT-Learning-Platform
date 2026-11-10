import { adminCsrf, csrfHeaderName, studentCsrf } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import { PasswordService, realmCookies } from "../../src/auth";
import { BreachedPasswordProvider } from "../../src/auth/breached-password.provider";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";
const trustedOrigin = "http://localhost:3000";

interface Reply {
  status: number;
  body: unknown;
  setCookies: string[];
  headers: Headers;
}

const pairs = (setCookies: string[]): string[] =>
  setCookies.map((line) => line.split(";")[0] ?? "").filter((pair) => !pair.endsWith("="));

const valueOf = (setCookies: string[], name: string): string | undefined =>
  pairs(setCookies)
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const codeOf = (reply: Reply) => (reply.body as { error: { code: string } }).error.code;

describe("CSRF protection", () => {
  const testApp = useTestApp();

  const call = async (
    method: "GET" | "POST",
    path: string,
    options: {
      cookie?: string;
      csrf?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ): Promise<Reply> => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method,
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...(options.csrf ? { [csrfHeaderName]: options.csrf } : {}),
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

  const student = async (): Promise<{ email: string }> => {
    const { user } = await testApp().factories.student();
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    return { email: user.email };
  };

  const signInStudent = async (email: string) => {
    const reply = await call("POST", "/auth/sign-in", { body: { email, password } });
    expect(reply.status).toBe(200);
    return {
      reply,
      cookie: pairs(reply.setCookies).join("; "),
      token: valueOf(reply.setCookies, studentCsrf.cookie) ?? "",
    };
  };

  const signInAdmin = async () => {
    vi.spyOn(testApp().moduleRef.get(BreachedPasswordProvider), "fetchRange").mockResolvedValue("");
    const admin = await testApp().factories.user({ role: "ADMIN" });
    await testApp().database.prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    const reply = await call("POST", "/admin/auth/sign-in", {
      body: { email: admin.email, password },
    });
    expect(reply.status).toBe(200);
    return {
      cookie: pairs(reply.setCookies).join("; "),
      token: valueOf(reply.setCookies, adminCsrf.cookie) ?? "",
    };
  };

  test("student sign-in issues a readable Strict __Host- CSRF cookie", async () => {
    const { email } = await student();

    const { reply, token } = await signInStudent(email);

    const line = reply.setCookies.find((entry) => entry.startsWith(`${studentCsrf.cookie}=`));
    expect(token).not.toBe("");
    expect(line).not.toMatch(/HttpOnly/i);
    expect(line).toMatch(/Secure/i);
    expect(line).toMatch(/SameSite=Strict/i);
    expect(line).toMatch(/Path=\/(;|$)/);
    expect(line).not.toMatch(/Domain=/i);
  });

  test("a signed-in unsafe request without the header is refused with 403 CSRF_TOKEN_INVALID", async () => {
    const { email } = await student();
    const { cookie } = await signInStudent(email);

    const missing = await call("POST", "/auth/sign-out", { cookie });

    expect(missing.status).toBe(403);
    expect(codeOf(missing)).toBe("CSRF_TOKEN_INVALID");
    expect((await call("GET", "/me", { cookie })).status).toBe(200);
  });

  test("a valid header and cookie let the request through", async () => {
    const { email } = await student();
    const { cookie, token } = await signInStudent(email);

    const out = await call("POST", "/auth/sign-out", { cookie, csrf: token });

    expect(out.status).toBe(204);
  });

  test("a token issued for session A is refused on session B of the same user", async () => {
    const { email } = await student();
    const a = await signInStudent(email);
    const b = await signInStudent(email);

    const crossed = await call("POST", "/auth/sign-out", {
      cookie: `${studentCsrfFree(b.cookie)}; ${studentCsrf.cookie}=${a.token}`,
      csrf: a.token,
    });

    expect(a.token).not.toBe(b.token);
    expect(crossed.status).toBe(403);
    expect(codeOf(crossed)).toBe("CSRF_TOKEN_INVALID");
  });

  test("a value planted in both the cookie and the header is refused", async () => {
    const { email } = await student();
    const { cookie } = await signInStudent(email);
    const forged = "A".repeat(43);

    const planted = await call("POST", "/auth/sign-out", {
      cookie: `${studentCsrfFree(cookie)}; ${studentCsrf.cookie}=${forged}`,
      csrf: forged,
    });

    expect(planted.status).toBe(403);
    expect(codeOf(planted)).toBe("CSRF_TOKEN_INVALID");
  });

  test("a student token does not open an admin route and the admin realm has its own token", async () => {
    const { email } = await student();
    const studentSession = await signInStudent(email);
    const admin = await signInAdmin();

    const crossed = await call("POST", "/admin/auth/sign-out", {
      cookie: admin.cookie,
      csrf: studentSession.token,
    });
    const own = await call("POST", "/admin/auth/sign-out", {
      cookie: admin.cookie,
      csrf: admin.token,
    });

    expect(admin.token).not.toBe(studentSession.token);
    expect(crossed.status).toBe(403);
    expect(own.status).toBe(204);
  });

  test("admin change-password is refused without the token", async () => {
    const admin = await signInAdmin();

    const reply = await call("POST", "/admin/account/change-password", {
      cookie: admin.cookie,
      body: { currentPassword: password, newPassword: "another long passphrase here" },
    });

    expect(reply.status).toBe(403);
    expect(codeOf(reply)).toBe("CSRF_TOKEN_INVALID");
  });

  test("the token endpoint returns the session token and re-sets the cookie", async () => {
    const { email } = await student();
    const { cookie, token } = await signInStudent(email);
    const withoutCsrfCookie = studentCsrfFree(cookie);

    const issued = await call("GET", "/auth/csrf", { cookie: withoutCsrfCookie });

    expect(issued.status).toBe(200);
    expect(issued.body).toEqual({ token });
    expect(valueOf(issued.setCookies, studentCsrf.cookie)).toBe(token);
    const out = await call("POST", "/auth/sign-out", {
      cookie: `${withoutCsrfCookie}; ${studentCsrf.cookie}=${token}`,
      csrf: token,
    });
    expect(out.status).toBe(204);
  });

  test("the token endpoint needs a session of its own realm", async () => {
    const { email } = await student();
    const { cookie } = await signInStudent(email);

    expect((await call("GET", "/auth/csrf")).status).toBe(401);
    expect((await call("GET", "/admin/auth/csrf", { cookie })).status).toBe(403);
  });

  test("refresh keeps the session, so the token stays valid, and rewrites the cookie", async () => {
    const { email } = await student();
    const { reply, token } = await signInStudent(email);
    const refreshCookie = `${realmCookies.student.refresh}=${valueOf(reply.setCookies, realmCookies.student.refresh)}`;

    const refreshed = await call("POST", "/auth/refresh", { cookie: refreshCookie });

    expect(refreshed.status).toBe(204);
    expect(valueOf(refreshed.setCookies, studentCsrf.cookie)).toBe(token);
    const cookie = pairs(refreshed.setCookies).join("; ");
    const refreshedToken = valueOf(refreshed.setCookies, studentCsrf.cookie);
    expect((await call("POST", "/auth/sign-out", { cookie, csrf: refreshedToken })).status).toBe(
      204,
    );
  });

  test("sign-out clears the CSRF cookie", async () => {
    const { email } = await student();
    const { cookie, token } = await signInStudent(email);

    const out = await call("POST", "/auth/sign-out", { cookie, csrf: token });

    expect(out.setCookies.some((line) => line.startsWith(`${studentCsrf.cookie}=;`))).toBe(true);
  });

  describe("requests without a session are covered by the Origin check", () => {
    test("sign-in from an untrusted Origin is refused with 403 ORIGIN_NOT_ALLOWED", async () => {
      const { email } = await student();

      const reply = await call("POST", "/auth/sign-in", {
        body: { email, password },
        headers: { origin: "https://evil.example.test" },
      });

      expect(reply.status).toBe(403);
      expect(codeOf(reply)).toBe("ORIGIN_NOT_ALLOWED");
      expect(reply.setCookies).toEqual([]);
    });

    test("sign-in from a cross-site fetch without Origin is refused", async () => {
      const { email } = await student();

      const reply = await call("POST", "/auth/sign-in", {
        body: { email, password },
        headers: { "sec-fetch-site": "cross-site" },
      });

      expect(reply.status).toBe(403);
      expect(codeOf(reply)).toBe("ORIGIN_NOT_ALLOWED");
    });

    test("sign-in from a trusted Origin works without any token", async () => {
      const { email } = await student();

      const reply = await call("POST", "/auth/sign-in", {
        body: { email, password },
        headers: { origin: trustedOrigin, "sec-fetch-site": "same-origin" },
      });

      expect(reply.status).toBe(200);
    });
  });

  test("every response carries HSTS, nosniff and Referrer-Policy, errors included", async () => {
    const ok = await call("GET", "/health");
    const refused = await call("POST", "/auth/sign-out");

    for (const reply of [ok, refused]) {
      expect(reply.headers.get("strict-transport-security")).toContain("max-age=31536000");
      expect(reply.headers.get("x-content-type-options")).toBe("nosniff");
      expect(reply.headers.get("referrer-policy")).toBe("no-referrer");
      expect(reply.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    }
  });
});

function studentCsrfFree(cookie: string): string {
  return cookie
    .split("; ")
    .filter((pair) => !pair.startsWith(`${studentCsrf.cookie}=`))
    .join("; ");
}
