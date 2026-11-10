import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { protectedPrefixes } from "../src/auth/session-gate";
import { config, proxy } from "../src/proxy";

const freshToken = (): string => {
  const exp = Math.floor(Date.now() / 1000) + 600;
  return `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
};

const request = (path: string, cookie?: string) =>
  new NextRequest(`https://learn.example${path}`, cookie ? { headers: { cookie } } : undefined);

describe("proxy", () => {
  test("redirects a learner page without a usable access cookie to the refresh page", () => {
    const response = proxy(request("/dashboard?x=1"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/auth/refresh");
    expect(new URL(response.headers.get("location") ?? "").searchParams.get("next")).toBe(
      "/dashboard?x=1",
    );
  });

  test("lets a learner page through and exposes its path to the data layer", () => {
    const response = proxy(request("/learn/a?x=1", `__Host-heat_access=${freshToken()}`));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-pathname")).toBe("/learn/a?x=1");
  });

  test("the matcher names exactly the protected prefixes", () => {
    const [pattern] = config.matcher;
    const names = /^\/\((.+)\)\/:path\*$/.exec(pattern ?? "")?.[1]?.split("|");

    expect(names?.map((name) => `/${name}`).sort()).toEqual([...protectedPrefixes].sort());
  });
});
