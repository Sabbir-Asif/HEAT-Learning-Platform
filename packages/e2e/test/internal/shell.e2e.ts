import { expect, test } from "@playwright/test";
import { settle, viewportFor } from "../support/matrix";

test.describe("admin drawer at phone width", () => {
  test.use({ viewport: viewportFor("phone") });

  test("opens from the trigger and returns focus to it when closed with Escape", async ({
    page,
  }) => {
    await page.goto("/");
    await settle(page, "light");
    const trigger = page.getByRole("button", { name: "Toggle Sidebar" });
    await trigger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("closes when a link is selected and focus returns to the trigger", async ({ page }) => {
    await page.goto("/");
    await settle(page, "light");
    const trigger = page.getByRole("button", { name: "Toggle Sidebar" });
    await trigger.click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("link", { name: "Videos" }).click();
    await expect(page).toHaveURL(/\/videos$/);
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("landmarks and skip link", () => {
  test.use({ viewport: viewportFor("laptop") });

  for (const path of ["/", "/sign-in"]) {
    test(`${path} has exactly one main landmark`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("main")).toHaveCount(1);
    });
  }

  test("the skip link is the first tab stop and moves focus to main", async ({ page }) => {
    await page.goto("/");
    await settle(page, "light");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });

  test("the sidebar lists Admins for a super admin", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Admins" }),
    ).toBeVisible();
  });
});
