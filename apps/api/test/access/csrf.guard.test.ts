import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { describe, expect, test } from "vitest";
import { Audience, Roles } from "../../src/access/access.decorators";
import { CsrfGuard } from "../../src/access/csrf.guard";
import type { AuthenticatedSession, AuthRealm } from "../../src/auth/auth.types";
import { CsrfTokenService } from "../../src/auth/csrf-token.service";
import { Public } from "../../src/auth/public.decorator";
import { ApiException } from "../../src/http/api-exception";
import { testConfig } from "../support/auth-fixtures";

class Bare {
  handler(): void {}
}

class Open {
  @Public()
  handler(): void {}
}

class StudentRoute {
  @Audience("student")
  handler(): void {}
}

class AdminRoute {
  @Audience("admin")
  @Roles("ADMIN")
  handler(): void {}
}

const trusted = "https://learn.example.test";
const config = testConfig({ TRUSTED_ORIGINS: `${trusted},https://admin.example.test` });
const csrf = new CsrfTokenService(config);
const guard = new CsrfGuard(new Reflector(), csrf, config);

const familyId = "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a";
const otherFamily = "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6b";
const cookieNames: Record<AuthRealm, string> = {
  student: "__Host-heat_csrf",
  admin: "__Host-heat_admin_csrf",
};

const session = (realm: AuthRealm, family = familyId): AuthenticatedSession => ({
  userId: "user",
  familyId: family,
  realm,
  role: realm === "admin" ? "ADMIN" : "STUDENT",
  mustChangePassword: false,
});

interface Setup {
  target: new () => object;
  method?: string;
  headers?: Record<string, string | string[]>;
  authSession?: AuthenticatedSession;
}

const run = (setup: Setup) => {
  const request = {
    method: setup.method ?? "POST",
    headers: setup.headers ?? {},
    authSession: setup.authSession,
  };
  const context = {
    getHandler: () => setup.target.prototype.handler,
    getClass: () => setup.target,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return guard.canActivate(context);
};

const withToken = (realm: AuthRealm, family = familyId, header?: string) => {
  const token = csrf.issue(realm, family);
  return {
    "x-csrf-token": header ?? token,
    cookie: `${cookieNames[realm]}=${token}`,
  };
};

const rejectsWith = (setup: Setup, code: string) => {
  expect(() => run(setup)).toThrowError(expect.objectContaining({ code, status: 403 }) as Error);
};

describe("CsrfGuard", () => {
  test.each(["GET", "HEAD", "OPTIONS"])("does not check %s requests", (method) => {
    expect(run({ target: StudentRoute, method, authSession: session("student") })).toBe(true);
  });

  test.each(["POST", "PUT", "PATCH", "DELETE"])(
    "refuses a signed-in %s without a token header",
    (method) => {
      rejectsWith(
        { target: StudentRoute, method, authSession: session("student") },
        "CSRF_TOKEN_INVALID",
      );
    },
  );

  test("accepts a signed-in request whose header and cookie carry the session token", () => {
    expect(
      run({ target: StudentRoute, headers: withToken("student"), authSession: session("student") }),
    ).toBe(true);
    expect(
      run({ target: AdminRoute, headers: withToken("admin"), authSession: session("admin") }),
    ).toBe(true);
  });

  test("refuses a token issued for another session", () => {
    rejectsWith(
      {
        target: StudentRoute,
        headers: withToken("student", otherFamily),
        authSession: session("student"),
      },
      "CSRF_TOKEN_INVALID",
    );
  });

  test("refuses a header that differs from the cookie", () => {
    const headers = withToken("student", familyId, csrf.issue("student", otherFamily));

    rejectsWith(
      { target: StudentRoute, headers, authSession: session("student") },
      "CSRF_TOKEN_INVALID",
    );
  });

  test("refuses a forged value planted in both the cookie and the header", () => {
    const forged = "x".repeat(43);

    rejectsWith(
      {
        target: StudentRoute,
        headers: { "x-csrf-token": forged, cookie: `${cookieNames.student}=${forged}` },
        authSession: session("student"),
      },
      "CSRF_TOKEN_INVALID",
    );
  });

  test("refuses a header without the cookie and a cookie without the header", () => {
    const token = csrf.issue("student", familyId);

    rejectsWith(
      { target: StudentRoute, headers: { "x-csrf-token": token }, authSession: session("student") },
      "CSRF_TOKEN_INVALID",
    );
    rejectsWith(
      {
        target: StudentRoute,
        headers: { cookie: `${cookieNames.student}=${token}` },
        authSession: session("student"),
      },
      "CSRF_TOKEN_INVALID",
    );
  });

  test("refuses a repeated header", () => {
    const token = csrf.issue("student", familyId);

    rejectsWith(
      {
        target: StudentRoute,
        headers: { "x-csrf-token": [token, token], cookie: `${cookieNames.student}=${token}` },
        authSession: session("student"),
      },
      "CSRF_TOKEN_INVALID",
    );
  });

  test("fails closed when a protected route has no session", () => {
    rejectsWith({ target: StudentRoute, headers: withToken("student") }, "CSRF_TOKEN_INVALID");
  });

  test("public unsafe routes need no token", () => {
    expect(run({ target: Open })).toBe(true);
  });

  test("a route without access metadata is not exempted by the token check", () => {
    expect(run({ target: Bare })).toBe(true);
  });

  describe("origin checks", () => {
    test("refuses an Origin that is not trusted, on public and protected routes", () => {
      rejectsWith(
        { target: Open, headers: { origin: "https://evil.example.test" } },
        "ORIGIN_NOT_ALLOWED",
      );
      rejectsWith(
        {
          target: StudentRoute,
          headers: { ...withToken("student"), origin: "https://evil.example.test" },
          authSession: session("student"),
        },
        "ORIGIN_NOT_ALLOWED",
      );
    });

    test("refuses the null origin and a sibling subdomain", () => {
      rejectsWith({ target: Open, headers: { origin: "null" } }, "ORIGIN_NOT_ALLOWED");
      rejectsWith(
        {
          target: Open,
          headers: { origin: "https://evil.example.test", "sec-fetch-site": "same-site" },
        },
        "ORIGIN_NOT_ALLOWED",
      );
    });

    test("accepts a trusted Origin", () => {
      expect(run({ target: Open, headers: { origin: trusted } })).toBe(true);
    });

    test("refuses a cross-site request even with a trusted Origin", () => {
      rejectsWith(
        { target: Open, headers: { origin: trusted, "sec-fetch-site": "cross-site" } },
        "ORIGIN_NOT_ALLOWED",
      );
    });

    test("without Origin, accepts same-origin and none, refuses same-site and cross-site", () => {
      expect(run({ target: Open, headers: { "sec-fetch-site": "same-origin" } })).toBe(true);
      expect(run({ target: Open, headers: { "sec-fetch-site": "none" } })).toBe(true);
      rejectsWith(
        { target: Open, headers: { "sec-fetch-site": "same-site" } },
        "ORIGIN_NOT_ALLOWED",
      );
      rejectsWith(
        { target: Open, headers: { "sec-fetch-site": "cross-site" } },
        "ORIGIN_NOT_ALLOWED",
      );
    });

    test("accepts a request with neither header, as sent by non-browser clients", () => {
      expect(run({ target: Open })).toBe(true);
    });
  });

  test("throws ApiException instances", () => {
    expect(() => run({ target: StudentRoute, authSession: session("student") })).toThrow(
      ApiException,
    );
  });
});
