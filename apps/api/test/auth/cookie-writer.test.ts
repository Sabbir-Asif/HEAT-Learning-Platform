import { describe, expect, test } from "vitest";
import { CookieWriter, realmCookies } from "../../src/auth/cookie-writer";
import type { CookieOptions } from "../../src/auth/cookie-writer";
import type { SessionTokens } from "../../src/auth/auth.types";
import { testConfig } from "../support/auth-fixtures";

interface Call {
  method: "cookie" | "clearCookie";
  name: string;
  value?: string;
  options: Partial<CookieOptions>;
}

const recorder = () => {
  const calls: Call[] = [];
  return {
    calls,
    response: {
      cookie: (name: string, value: string, options: CookieOptions) =>
        calls.push({ method: "cookie", name, value, options }),
      clearCookie: (name: string, options: Omit<CookieOptions, "maxAge">) =>
        calls.push({ method: "clearCookie", name, options }),
    },
  };
};

const tokens: SessionTokens = {
  accessToken: "access-value",
  refreshToken: "refresh-value",
  familyId: "family",
  accessExpiresAt: new Date(),
  refreshExpiresAt: new Date(),
};

describe("CookieWriter", () => {
  const writer = new CookieWriter(testConfig());

  test("writes the student access cookie as __Host-, Lax, 10 minutes, Path=/", () => {
    const { calls, response } = recorder();
    writer.write(response, "student", tokens);

    expect(calls[0]).toEqual({
      method: "cookie",
      name: "__Host-heat_access",
      value: "access-value",
      options: { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600_000 },
    });
  });

  test("writes the student refresh cookie as __Secure-, Strict, limited to its endpoint", () => {
    const { calls, response } = recorder();
    writer.write(response, "student", tokens);

    expect(calls[1]).toEqual({
      method: "cookie",
      name: "__Secure-heat_refresh",
      value: "refresh-value",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/api/auth/refresh",
        maxAge: 30 * 86_400_000,
      },
    });
    expect(calls[1]?.options).not.toHaveProperty("domain");
  });

  test("uses distinct names and the admin refresh path for the admin realm", () => {
    const { calls, response } = recorder();
    writer.write(response, "admin", tokens);

    expect(calls.map((call) => call.name)).toEqual([
      "__Host-heat_admin_access",
      "__Secure-heat_admin_refresh",
    ]);
    expect(calls[1]?.options.path).toBe("/api/admin/auth/refresh");
    const names = [...Object.values(realmCookies.student), ...Object.values(realmCookies.admin)];
    expect(new Set(names).size).toBe(names.length);
  });

  test("clears both cookies with the attributes they were set with", () => {
    const { calls, response } = recorder();
    writer.clear(response, "admin");

    expect(calls).toEqual([
      {
        method: "clearCookie",
        name: "__Host-heat_admin_access",
        options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
      },
      {
        method: "clearCookie",
        name: "__Secure-heat_admin_refresh",
        options: {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/api/admin/auth/refresh",
        },
      },
    ]);
  });
});
