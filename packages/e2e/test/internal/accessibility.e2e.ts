import { expect, test } from "@playwright/test";
import { routeManifest } from "../../../../apps/frontend-internal/src/routes/manifest";
import { defineAccessibilitySuite } from "../support/accessibility-suite";
import { scan } from "../support/axe";
import { settle, viewportFor } from "../support/matrix";

defineAccessibilitySuite(routeManifest);

test.describe("admin navigation sheet", () => {
  test.use({ viewport: viewportFor("phone"), colorScheme: "light" });

  test("the open sheet has no violations", async ({ page }) => {
    await page.goto("/");
    await settle(page, "light");
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("navigation", { name: "Admin" })).toBeVisible();
    expect(await scan(page)).toEqual([]);
  });
});
