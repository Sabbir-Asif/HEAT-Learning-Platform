import { describe, expect, test } from "vitest";
import { routeManifest } from "../../src/routes/manifest";
import {
  accessExpiry,
  decideGate,
  isProtectedPath,
  needsRefresh,
} from "../../src/auth/session-gate";

const now = Date.parse("2026-11-09T04:00:00Z");

const tokenExpiringIn = (seconds: number): string => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + seconds })).toString(
    "base64url",
  );
  return `header.${payload}.signature`;
};

describe("accessExpiry", () => {
  test("reads exp from the payload without verifying", () => {
    expect(accessExpiry(tokenExpiringIn(100))).toBe(Math.floor(now / 1000) + 100);
  });

  test.each([
    undefined,
    "",
    "abc",
    "a.b.c",
    "a..c",
    `a.${Buffer.from("[]").toString("base64url")}.c`,
  ])("is undefined for %j", (token) => {
    expect(accessExpiry(token)).toBeUndefined();
  });

  test("is undefined when exp is not a number", () => {
    const payload = Buffer.from(JSON.stringify({ exp: "soon" })).toString("base64url");

    expect(accessExpiry(`a.${payload}.c`)).toBeUndefined();
  });
});

describe("needsRefresh", () => {
  test("is false with more than 60 seconds left", () => {
    expect(needsRefresh(tokenExpiringIn(61), now)).toBe(false);
  });

  test("is true at 60 seconds, when expired, and when the cookie is missing or unreadable", () => {
    expect(needsRefresh(tokenExpiringIn(60), now)).toBe(true);
    expect(needsRefresh(tokenExpiringIn(-5), now)).toBe(true);
    expect(needsRefresh(undefined, now)).toBe(true);
    expect(needsRefresh("garbage", now)).toBe(true);
  });
});

describe("decideGate", () => {
  test("lets a learner page through with a fresh access cookie", () => {
    expect(
      decideGate({
        pathname: "/dashboard",
        search: "",
        accessToken: tokenExpiringIn(300),
        nowMs: now,
      }),
    ).toEqual({ kind: "pass" });
  });

  test("sends a learner page with an expired or missing cookie to the refresh page, keeping the query", () => {
    expect(
      decideGate({ pathname: "/learn/a", search: "?tab=1", accessToken: undefined, nowMs: now }),
    ).toEqual({ kind: "refresh", location: "/auth/refresh?next=%2Flearn%2Fa%3Ftab%3D1" });
    expect(
      decideGate({
        pathname: "/dashboard",
        search: "",
        accessToken: tokenExpiringIn(10),
        nowMs: now,
      }),
    ).toMatchObject({ kind: "refresh" });
  });

  test("never gates public or auth pages", () => {
    for (const pathname of ["/", "/courses", "/sign-in", "/auth/refresh", "/enroll"]) {
      expect(decideGate({ pathname, search: "", accessToken: undefined, nowMs: now })).toEqual({
        kind: "pass",
      });
    }
  });
});

describe("isProtectedPath", () => {
  test("covers every learner route in the manifest and awaiting-approval", () => {
    const learner = routeManifest.filter((route) => route.kind === "learner");

    expect(learner.length).toBeGreaterThan(0);
    for (const route of learner) expect(isProtectedPath(route.path)).toBe(true);
    expect(isProtectedPath("/awaiting-approval")).toBe(true);
  });

  test("does not match a path that only shares a prefix", () => {
    expect(isProtectedPath("/learning-resources")).toBe(false);
    expect(isProtectedPath("/profiles")).toBe(false);
  });
});
