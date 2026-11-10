import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { config, proxy } from "../src/proxy";

const freshToken = (): string => {
  const exp = Math.floor(Date.now() / 1000) + 600;
  return `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
};

const request = (path: string, cookie?: string) =>
  new NextRequest(`https://admin.example${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy", () => {
  test("redirects an admin page without a usable access cookie to the refresh page", () => {
    const response = proxy(request("/students?x=1"));
    const location = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(location.pathname).toBe("/auth/refresh");
    expect(location.searchParams.get("next")).toBe("/students?x=1");
  });

  test("lets an admin page through and exposes its path to the data layer", () => {
    const response = proxy(request("/account", `__Host-heat_admin_access=${freshToken()}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-pathname")).toBe("/account");
  });

  test("a student access cookie does not open an admin page", () => {
    const response = proxy(request("/", `__Host-heat_access=${freshToken()}`));

    expect(response.status).toBe(307);
  });

  test("does not gate sign-in", () => {
    expect(proxy(request("/sign-in")).status).toBe(200);
  });

  test("the matcher skips build assets", () => {
    const [pattern] = config.matcher;
    const matcher = new RegExp(`^${pattern}$`);

    expect(matcher.test("/students")).toBe(true);
    expect(matcher.test("/_next/static/app.js")).toBe(false);
    expect(matcher.test("/brand/heat.svg")).toBe(false);
  });
});
