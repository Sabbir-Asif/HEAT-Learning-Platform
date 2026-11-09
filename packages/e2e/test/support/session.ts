import type { BrowserContext, Page, Route } from "@playwright/test";

export const accessCookieName = "__Host-heat_access";

export const accessToken = (expiresInSeconds: number): string => {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `e2e.${payload}.signature`;
};

export const grantAccess = (
  context: BrowserContext,
  baseURL: string | undefined,
  expiresInSeconds = 600,
) =>
  context.addCookies([
    {
      name: accessCookieName,
      value: accessToken(expiresInSeconds),
      domain: new URL(baseURL ?? "http://localhost:3000").hostname,
      path: "/",
      secure: true,
    },
  ]);

export const dropAccess = (context: BrowserContext) => context.clearCookies();

export const meBody = (statuses: ReadonlyArray<string>) => ({
  user: {
    id: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a",
    email: "student@du.ac.bd",
    role: "STUDENT",
    emailVerified: true,
    mustChangePassword: false,
  },
  enrollments: statuses.map((status, index) => ({
    courseId: `0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6${index}`,
    courseSlug: `course-${index}`,
    courseTitle: `Course ${index}`,
    status,
  })),
});

export const jsonRoute = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

export const unauthenticated = (route: Route) =>
  jsonRoute(route, 401, {
    error: { code: "UNAUTHENTICATED", message: "Sign in to continue.", requestId: "e2e" },
  });

export const invalidCredentials = (route: Route) =>
  jsonRoute(route, 401, {
    error: {
      code: "INVALID_CREDENTIALS",
      message: "The email or password is not correct.",
      requestId: "e2e",
    },
  });

export const countRequests = (page: Page, pattern: string) => {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(pattern)) seen.push(request.method());
  });
  return seen;
};
