import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { viewportFor, widthNames } from "../support/matrix";
import type { WidthName } from "../support/matrix";
import {
  countRequests,
  grantAccess,
  invalidCredentials,
  jsonRoute,
  meBody,
  unauthenticated,
} from "../support/session";

const acceptRefresh = (
  context: BrowserContext,
  baseURL: string | undefined,
  expiresInSeconds = 600,
) =>
  context.route("**/api/auth/refresh", async (route) => {
    await grantAccess(context, baseURL, expiresInSeconds);
    await route.fulfill({ status: 204 });
  });

for (const width of widthNames as WidthName[]) {
  test.describe(`student authentication at ${width} width`, () => {
    test.use({ viewport: viewportFor(width) });

    test("signing in with an approved course lands on the dashboard", async ({
      page,
      context,
      baseURL,
    }) => {
      await context.route("**/api/auth/sign-in", async (route) => {
        await grantAccess(context, baseURL);
        await jsonRoute(route, 200, meBody(["APPROVED"]));
      });
      await page.goto("/sign-in");

      await page.getByLabel("University email").fill("student@du.ac.bd");
      await page.getByLabel("Password").fill("correct horse battery");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).toHaveURL(/\/dashboard$/);
    });

    test("signing in with only a pending request lands on awaiting approval", async ({
      page,
      context,
      baseURL,
    }) => {
      await context.route("**/api/auth/sign-in", async (route) => {
        await grantAccess(context, baseURL);
        await jsonRoute(route, 200, meBody(["PENDING_APPROVAL"]));
      });
      await page.goto("/sign-in");

      await page.getByLabel("University email").fill("student@du.ac.bd");
      await page.getByLabel("Password").fill("correct horse battery");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).toHaveURL(/\/awaiting-approval$/);
    });

    test("wrong credentials show one generic message and stay on the page", async ({
      page,
      context,
    }) => {
      await context.route("**/api/auth/sign-in", invalidCredentials);
      await page.goto("/sign-in");

      await page.getByLabel("University email").fill("student@du.ac.bd");
      await page.getByLabel("Password").fill("wrong");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("The email or password is not correct.")).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("an expired access cookie is refreshed and the page renders", async ({
      page,
      context,
      baseURL,
    }) => {
      await grantAccess(context, baseURL, -30);
      await acceptRefresh(context, baseURL);
      const refreshes = countRequests(page, "/api/auth/refresh");

      await page.goto("/dashboard");

      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      expect(refreshes).toEqual(["POST"]);
    });

    test("a rejected refresh sends the visitor to sign-in", async ({ page, context, baseURL }) => {
      await grantAccess(context, baseURL, -30);
      await context.route("**/api/auth/refresh", unauthenticated);

      await page.goto("/learn/course-0");

      await expect(page).toHaveURL(/\/sign-in\?next=%2Flearn%2Fcourse-0$/);
    });

    test("the refresh page ignores a next address that leaves the site", async ({
      page,
      context,
      baseURL,
    }) => {
      await acceptRefresh(context, baseURL);

      await page.goto("/auth/refresh?next=https%3A%2F%2Fevil.example%2Fdashboard");

      await expect(page).toHaveURL(`${baseURL}/dashboard`);
    });

    test("signing out revokes the session and protected pages ask for sign-in again", async ({
      page,
      context,
      baseURL,
    }) => {
      await grantAccess(context, baseURL);
      await context.route("**/api/auth/sign-out", async (route) => {
        await context.clearCookies();
        await route.fulfill({ status: 204 });
      });
      await context.route("**/api/auth/refresh", unauthenticated);
      const signOuts = countRequests(page, "/api/auth/sign-out");
      await page.goto("/profile");

      await page.getByRole("button", { name: "Sign out" }).click();

      await expect(page).toHaveURL(/\/sign-in$/);
      expect(signOuts).toEqual(["POST"]);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
    });
  });
}
