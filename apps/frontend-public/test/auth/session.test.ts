import { ApiError } from "@heat/api-client";
import type { MeResponse } from "@heat/contracts";
import { beforeEach, describe, expect, test, vi } from "vitest";

const calls: string[] = [];
const meDescribe = vi.fn();
const connection = vi.fn(async () => {
  calls.push("connection");
});
const headerValues = new Map<string, string>();
const redirect = vi.fn((location: string): never => {
  throw new Error(`redirect:${location}`);
});

vi.mock("server-only", () => ({}));
vi.mock("@heat/api-client/server", () => ({ meDescribe: () => meDescribe() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => headerValues.get(n) ?? null }),
}));
vi.mock("next/navigation", () => ({ redirect: (location: string) => redirect(location) }));
vi.mock("next/server", () => ({ connection: () => connection() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

const me = (statuses: Array<[string, string]>): MeResponse => ({
  user: {
    id: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a",
    email: "a@b.test",
    role: "STUDENT",
    emailVerified: true,
    mustChangePassword: false,
  },
  enrollments: statuses.map(([courseSlug, status]) => ({
    courseId: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6b",
    courseSlug,
    courseTitle: courseSlug,
    status: status as MeResponse["enrollments"][number]["status"],
  })),
  verificationEmail: null,
  verificationEmailSentAt: null,
});

beforeEach(() => {
  meDescribe.mockReset();
  connection.mockClear();
  calls.length = 0;
  redirect.mockClear();
  headerValues.clear();
});

describe("verifySession", () => {
  test("returns the session from /me", async () => {
    const session = me([["a", "APPROVED"]]);
    meDescribe.mockResolvedValue(session);
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).resolves.toBe(session);
  });

  test("waits for a request before calling the API so the page is never prerendered", async () => {
    meDescribe.mockImplementation(() => {
      calls.push("me");
      return Promise.resolve(me([]));
    });
    const { verifySession } = await import("../../src/auth/session");

    await verifySession();

    expect(calls).toEqual(["connection", "me"]);
  });

  test("redirects to the refresh page with the current path on 401", async () => {
    headerValues.set("x-pathname", "/learn/a?x=1");
    meDescribe.mockRejectedValue(new ApiError({ status: 401, code: "UNAUTHENTICATED" }));
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).rejects.toThrow(
      "redirect:/auth/refresh?next=%2Flearn%2Fa%3Fx%3D1",
    );
  });

  test("ignores an unsafe path header when redirecting", async () => {
    headerValues.set("x-pathname", "https://evil.example");
    meDescribe.mockRejectedValue(new ApiError({ status: 401, code: "UNAUTHENTICATED" }));
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).rejects.toThrow("redirect:/auth/refresh?next=%2Fdashboard");
  });

  test("rethrows other failures", async () => {
    meDescribe.mockRejectedValue(new ApiError({ status: 500, code: "INTERNAL" }));
    const { verifySession } = await import("../../src/auth/session");

    await expect(verifySession()).rejects.toMatchObject({ status: 500 });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("requireCourseAccess", () => {
  test.each(["APPROVED", "COMPLETED"])(
    "returns the %s enrollment for the course",
    async (status) => {
      meDescribe.mockResolvedValue(
        me([
          ["a", status],
          ["b", "PENDING_APPROVAL"],
        ]),
      );
      const { requireCourseAccess } = await import("../../src/auth/session");

      const access = await requireCourseAccess("a");

      expect(access.enrollment.courseSlug).toBe("a");
    },
  );

  test.each(["PENDING_APPROVAL", "REMOVED", "REJECTED"])(
    "sends a %s enrollment to the course overview",
    async (status) => {
      meDescribe.mockResolvedValue(me([["a", status]]));
      const { requireCourseAccess } = await import("../../src/auth/session");

      await expect(requireCourseAccess("a")).rejects.toThrow("redirect:/courses/a");
    },
  );

  test("sends a course the student never joined to the course overview", async () => {
    meDescribe.mockResolvedValue(me([["a", "APPROVED"]]));
    const { requireCourseAccess } = await import("../../src/auth/session");

    await expect(requireCourseAccess("other")).rejects.toThrow("redirect:/courses/other");
  });
});
