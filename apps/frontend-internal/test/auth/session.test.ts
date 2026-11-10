import { ApiError } from "@heat/api-client";
import type { AdminMeResponse } from "@heat/contracts";
import { beforeEach, describe, expect, test, vi } from "vitest";

const adminMeDescribe = vi.fn();
const callOrder: string[] = [];
const connection = vi.fn(async () => {
  callOrder.push("connection");
});
const headerValues = new Map<string, string>();
const redirect = vi.fn((location: string): never => {
  throw new Error(`redirect:${location}`);
});

vi.mock("server-only", () => ({}));
vi.mock("@heat/api-client/server", () => ({ adminMeDescribe: () => adminMeDescribe() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerValues.get(name) ?? null }),
}));
vi.mock("next/server", () => ({ connection: () => connection() }));
vi.mock("next/navigation", () => ({ redirect: (location: string) => redirect(location) }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const session = (mustChangePassword: boolean): AdminMeResponse => ({
  user: {
    id: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a",
    email: "admin@du.ac.bd",
    role: "SUPER_ADMIN",
    mustChangePassword,
  },
});

beforeEach(() => {
  adminMeDescribe.mockReset();
  redirect.mockClear();
  headerValues.clear();
  callOrder.length = 0;
  connection.mockClear();
});

describe("verifySession", () => {
  test("opts into dynamic rendering before calling the API", async () => {
    adminMeDescribe.mockImplementation(async () => {
      callOrder.push("api");
      return session(false);
    });
    const { verifySession } = await import("../../src/auth/session");

    await verifySession();

    expect(callOrder).toEqual(["connection", "api"]);
  });

  test("returns the session from /admin/me", async () => {
    const current = session(false);
    adminMeDescribe.mockResolvedValue(current);
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).resolves.toBe(current);
  });

  test("redirects to the refresh page with the current path on 401", async () => {
    headerValues.set("x-pathname", "/students?x=1");
    adminMeDescribe.mockRejectedValue(new ApiError({ status: 401, code: "UNAUTHENTICATED" }));
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).rejects.toThrow(
      "redirect:/auth/refresh?next=%2Fstudents%3Fx%3D1",
    );
  });

  test("ignores an unsafe path header when redirecting", async () => {
    headerValues.set("x-pathname", "https://evil.example");
    adminMeDescribe.mockRejectedValue(new ApiError({ status: 401, code: "UNAUTHENTICATED" }));
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).rejects.toThrow("redirect:/auth/refresh?next=%2F");
  });

  test("rethrows other failures", async () => {
    adminMeDescribe.mockRejectedValue(new ApiError({ status: 500, code: "INTERNAL" }));
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).rejects.toMatchObject({ status: 500 });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("verifyReadySession", () => {
  test("returns the session when no password change is pending", async () => {
    adminMeDescribe.mockResolvedValue(session(false));
    headerValues.set("x-pathname", "/students");
    const { verifyReadySession } = await import("../../src/auth/session");

    await expect(verifyReadySession()).resolves.toMatchObject({ user: { role: "SUPER_ADMIN" } });
  });

  test("sends a pending password change to the account page from any other page", async () => {
    adminMeDescribe.mockResolvedValue(session(true));
    headerValues.set("x-pathname", "/students?page=2");
    const { verifyReadySession } = await import("../../src/auth/session");

    await expect(verifyReadySession()).rejects.toThrow("redirect:/account");
  });

  test("stays on the account page while the change is pending", async () => {
    adminMeDescribe.mockResolvedValue(session(true));
    headerValues.set("x-pathname", "/account");
    const { verifyReadySession } = await import("../../src/auth/session");

    await expect(verifyReadySession()).resolves.toMatchObject({
      user: { mustChangePassword: true },
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
