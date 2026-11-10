import { expect, test } from "@playwright/test";
import { settle, viewportFor } from "../support/matrix";
import { grantAccess } from "../support/session";

test.beforeEach(async ({ context, baseURL }) => {
  await grantAccess(context, baseURL);
});

test.describe("learner bottom bar", () => {
  test.describe("at phone width", () => {
    test.use({ viewport: viewportFor("phone") });

    test("shows exactly five items and marks the current page", async ({ page }) => {
      await page.goto("/learn");
      const bar = page.getByRole("navigation", { name: "Learner mobile" });
      await expect(bar).toBeVisible();
      await expect(bar.getByRole("link")).toHaveCount(5);
      await expect(bar.locator("[aria-current='page']")).toHaveCount(1);
      await expect(bar.getByRole("link", { name: "My Learning" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  });

  test.describe("at laptop width", () => {
    test.use({ viewport: viewportFor("laptop") });

    test("is not shown", async ({ page }) => {
      await page.goto("/learn");
      await expect(page.getByRole("navigation", { name: "Learner mobile" })).toBeHidden();
    });
  });
});

test.describe("landmarks and skip link", () => {
  test.use({ viewport: viewportFor("laptop") });

  for (const path of ["/", "/sign-in", "/dashboard"]) {
    test(`${path} has exactly one main landmark`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("main")).toHaveCount(1);
    });
  }

  test("the skip link is the first tab stop and moves focus to main", async ({ page }) => {
    await page.goto("/");
    await settle(page, "light");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
  });
});
