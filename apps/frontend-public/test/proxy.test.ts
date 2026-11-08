import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { config, proxy } from "../src/proxy";

function request(
  path: string,
  headers: Record<string, string> = {},
  origin = "http://learn.localhost",
) {
  return new NextRequest(`${origin}${path}`, { headers });
}

function destination(response: Response) {
  const url = new URL(response.headers.get("location") ?? "", "http://learn.localhost");
  return `${url.pathname}${url.search}`;
}

describe("redirect from /", () => {
  test("sends en-US,en;q=0.9 to /en with 307 and the cache headers", () => {
    const response = proxy(request("/", { "accept-language": "en-US,en;q=0.9" }));
    expect(response.status).toBe(307);
    expect(destination(response)).toBe("/en");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Accept-Language, Cookie");
  });

  test.each([["fr"], ["*"], [""], [undefined]])(
    "sends Accept-Language %j with no cookie to /bn",
    (acceptLanguage) => {
      const response = proxy(
        request("/", acceptLanguage === undefined ? {} : { "accept-language": acceptLanguage }),
      );
      expect(response.status).toBe(307);
      expect(destination(response)).toBe("/bn");
    },
  );

  test.each([
    ["en;q=0.8, bn;q=0.9", "/bn"],
    ["bn-BD", "/bn"],
    ["bn-IN", "/bn"],
    ["EN-us", "/en"],
    ["en;q=0, fr", "/bn"],
    ["en;q=abc", "/bn"],
    ["en;q=2", "/bn"],
    ["en, bn", "/en"],
    ["bn, en", "/bn"],
  ])("sends Accept-Language %j to %s", (acceptLanguage, location) => {
    const response = proxy(request("/", { "accept-language": acceptLanguage }));
    expect(destination(response)).toBe(location);
  });

  test("the locale cookie wins over Accept-Language", () => {
    const response = proxy(request("/", { cookie: "__Host-locale=bn", "accept-language": "en" }));
    expect(destination(response)).toBe("/bn");
    const other = proxy(request("/", { cookie: "__Host-locale=en", "accept-language": "bn" }));
    expect(destination(other)).toBe("/en");
  });

  test("finds the cookie among others", () => {
    const response = proxy(
      request("/", { cookie: "a=1; __Host-locale=en; b=2", "accept-language": "bn" }),
    );
    expect(destination(response)).toBe("/en");
  });

  test.each(["fr", "BN", "", "bn%3Bx", "bnbnbnbnbnbnbnbnbnbn"])(
    "ignores the cookie value %j and lets Accept-Language decide",
    (value) => {
      const response = proxy(
        request("/", { cookie: `__Host-locale=${value}`, "accept-language": "en" }),
      );
      expect(destination(response)).toBe("/en");
    },
  );

  test("keeps the query byte for byte", () => {
    const response = proxy(
      request("/?utm_source=a%20b&x=%E0%A6%AC&y=", { "accept-language": "bn" }),
    );
    expect(destination(response)).toBe("/bn?utm_source=a%20b&x=%E0%A6%AC&y=");
  });

  test("never sets a cookie", () => {
    const response = proxy(request("/", { "accept-language": "en" }));
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.cookies.getAll()).toEqual([]);
  });

  test("points at the same host the request came to, so Next.js can make it relative", () => {
    const response = proxy(request("/", { "accept-language": "en" }, "http://evil.example"));
    expect(destination(response)).toBe("/en");
    expect(new URL(response.headers.get("location") ?? "").origin).toBe("http://evil.example");
    expect(JSON.stringify([...response.headers])).not.toMatch(/http:\/\/(?!evil\.example)/);
  });

  test.each([
    "en\r\nSet-Cookie: x=1",
    "https://evil.example/en",
    "//evil.example",
    "fr\u0000en",
    "en;q=0.5\nLocation: https://evil.example",
  ])("never echoes the Accept-Language value %j", (value) => {
    let response;
    try {
      response = proxy(request("/", { "accept-language": value }));
    } catch {
      return;
    }
    expect(["/en", "/bn"]).toContain(destination(response));
    expect(JSON.stringify([...response.headers])).not.toContain("evil");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("pass-through", () => {
  test.each([
    "/bn",
    "/en",
    "/en/x",
    "/bn/courses/a?tab=2",
    "/sign-in",
    "/fr",
    "/_next/static/x.js",
    "/api/revalidate",
    "/brand/heat.svg",
    "/favicon.ico",
    "//",
    "/index",
  ])("%s is not redirected, not given a cookie and not given cache headers", (path) => {
    const response = proxy(request(path, { cookie: "__Host-locale=bn", "accept-language": "en" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("vary")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("matcher", () => {
  test("only runs for /", () => {
    expect(config.matcher).toEqual(["/"]);
  });
});
