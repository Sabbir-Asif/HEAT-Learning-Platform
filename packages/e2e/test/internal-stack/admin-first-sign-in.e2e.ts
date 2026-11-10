import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const seededPassword = process.env.E2E_ADMIN_PASSWORD;
const newPassword = process.env.E2E_ADMIN_NEW_PASSWORD;

test.describe("first sign-in of the seeded super admin", () => {
  test.skip(
    !email || !seededPassword || !newPassword,
    "Needs the real stack and E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD and E2E_ADMIN_NEW_PASSWORD",
  );

  test("is forced through a password change, then signs in normally", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email ?? "");
    await page.getByLabel("Password").fill(seededPassword ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText("Set a new password before you continue.")).toBeVisible();

    await page.goto("/students");
    await expect(page).toHaveURL(/\/account$/);

    await page.getByLabel("Current password").fill(seededPassword ?? "");
    await page.getByLabel("New password").fill("short");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Use at least 12 characters.")).toBeVisible();

    await page.getByLabel("New password").fill(newPassword ?? "");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/students");
    await expect(page).toHaveURL(/\/students$/);

    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);

    await page.goto("/students");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fstudents$/);

    await page.getByLabel("Email").fill(email ?? "");
    await page.getByLabel("Password").fill(seededPassword ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("The email or password is not correct.")).toBeVisible();

    await page.getByLabel("Password").fill(newPassword ?? "");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/students$/);
  });
});
