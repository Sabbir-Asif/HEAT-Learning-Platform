import { adminSessionCookies } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import { routeManifest } from "../../src/routes/manifest";
import {
  accessCookieName,
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

describe("session gate", () => {
  test("reads the admin access cookie", () => {
    expect(accessCookieName).toBe(adminSessionCookies.access);
  });

  test("accessExpiry reads exp without verifying and is undefined for junk", () => {
    expect(accessExpiry(tokenExpiringIn(100))).toBe(Math.floor(now / 1000) + 100);
    for (const token of [undefined, "", "abc", "a.b.c", "a..c"]) {
      expect(accessExpiry(token)).toBeUndefined();
    }
    const payload = Buffer.from(JSON.stringify({ exp: "soon" })).toString("base64url");
    expect(accessExpiry(`a.${payload}.c`)).toBeUndefined();
  });

  test("needsRefresh is false with more than 60 seconds left and true otherwise", () => {
    expect(needsRefresh(tokenExpiringIn(61), now)).toBe(false);
    expect(needsRefresh(tokenExpiringIn(60), now)).toBe(true);
    expect(needsRefresh(tokenExpiringIn(-5), now)).toBe(true);
    expect(needsRefresh(undefined, now)).toBe(true);
  });

  test("an admin page with a fresh cookie passes", () => {
    expect(
      decideGate({
        pathname: "/students",
        search: "",
        accessToken: tokenExpiringIn(300),
        nowMs: now,
      }),
    ).toEqual({ kind: "pass" });
  });

  test("an admin page with a missing or expired cookie goes to the refresh page, keeping the query", () => {
    expect(
      decideGate({ pathname: "/students", search: "?page=2", accessToken: undefined, nowMs: now }),
    ).toEqual({ kind: "refresh", location: "/auth/refresh?next=%2Fstudents%3Fpage%3D2" });
    expect(
      decideGate({ pathname: "/", search: "", accessToken: tokenExpiringIn(10), nowMs: now }),
    ).toMatchObject({ kind: "refresh" });
  });

  test("sign-in and the refresh page are never gated", () => {
    for (const pathname of ["/sign-in", "/auth/refresh", "/reset-password/abc"]) {
      expect(decideGate({ pathname, search: "", accessToken: undefined, nowMs: now })).toEqual({
        kind: "pass",
      });
    }
  });

  test("every admin route in the manifest is protected and every auth route that needs no session is open", () => {
    for (const route of routeManifest.filter((entry) => entry.kind === "admin")) {
      expect(isProtectedPath(route.path)).toBe(true);
    }
    expect(isProtectedPath("/sign-in")).toBe(false);
    expect(isProtectedPath("/sign-instead")).toBe(true);
  });
});
