import { expect, test } from "@playwright/test";
import { viewportFor, widthNames } from "../support/matrix";
import type { WidthName } from "../support/matrix";
import {
  adminAccessCookieName,
  grantAccess,
  invalidCredentials,
  jsonRoute,
} from "../support/session";

const adminMe = (mustChangePassword: boolean) => ({
  user: {
    id: "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a",
    email: "super.admin@du.ac.bd",
    role: "SUPER_ADMIN",
    mustChangePassword,
  },
});

for (const width of widthNames as WidthName[]) {
  test.describe(`admin sign-in at ${width} width`, () => {
    test.use({ viewport: viewportFor(width) });

    test("wrong credentials show one generic message and stay on the page", async ({
      page,
      context,
    }) => {
      await context.route("**/api/admin/auth/sign-in", invalidCredentials);
      await page.goto("/sign-in");

      await page.getByLabel("Email").fill("admin@du.ac.bd");
      await page.getByLabel("Password").fill("wrong");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page.getByText("The email or password is not correct.")).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("a sign-in that needs a password change lands on the account page", async ({
      page,
      context,
      baseURL,
    }) => {
      await context.route("**/api/admin/auth/sign-in", async (route) => {
        await grantAccess(context, baseURL, 600, adminAccessCookieName);
        await jsonRoute(route, 200, adminMe(true));
      });
      await page.goto("/sign-in?next=%2Fstudents");

      await page.getByLabel("Email").fill("super.admin@du.ac.bd");
      await page.getByLabel("Password").fill("seeded password value");
      await page.getByRole("button", { name: "Sign in" }).click();

      await expect(page).toHaveURL(/\/account$/);
    });

    test("an expired access cookie is refreshed through the admin endpoint", async ({
      page,
      context,
      baseURL,
    }) => {
      await grantAccess(context, baseURL, -30, adminAccessCookieName);
      const refreshes: string[] = [];
      await context.route("**/api/admin/auth/refresh", async (route) => {
        refreshes.push(route.request().method());
        await grantAccess(context, baseURL, 600, adminAccessCookieName);
        await route.fulfill({ status: 204 });
      });

      await page.goto("/");

      await expect(page).toHaveURL(/\/$/);
      expect(refreshes).toEqual(["POST"]);
    });

    test("a rejected refresh sends the visitor to sign-in", async ({ page, context, baseURL }) => {
      await grantAccess(context, baseURL, -30, adminAccessCookieName);
      await context.route("**/api/admin/auth/refresh", (route) =>
        jsonRoute(route, 401, {
          error: { code: "UNAUTHENTICATED", message: "Sign in to continue.", requestId: "e2e" },
        }),
      );

      await page.goto("/students");

      await expect(page).toHaveURL(/\/sign-in\?next=%2Fstudents$/);
    });
  });
}
