import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const referencedUniversity = process.env.E2E_REFERENCED_UNIVERSITY;

const signIn = async (page: Page) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
};

const university = (suffix: string) => `E2E University ${suffix}`;

test.describe("university directory", () => {
  test.skip(
    !email || !password,
    "Needs the real stack, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD of a super admin who has already set a password",
  );

  test("laptop: create, rename, reject a duplicate and delete an unused university", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const name = university(String(Date.now()));
    const renamed = `${name} Renamed`;

    await page.goto("/directory/universities");
    await page.getByRole("button", { name: "Add university" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} was added.` })).toBeVisible();

    await page.getByRole("button", { name: "Add university" }).click();
    await page.getByLabel("Name").fill(name.toUpperCase());
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("A university with this name already exists.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Discard changes" }).click();

    await page.getByLabel("Search universities").fill(name);
    await expect(page).toHaveURL(/q=/);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(renamed);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `${renamed} was saved.` }),
    ).toBeVisible();

    await page.getByLabel("Search universities").fill(renamed);
    await page
      .getByRole("row", { name: new RegExp(renamed) })
      .getByRole("button", { name: "Delete" })
      .click();
    const confirm = page.getByRole("button", { name: "Delete university" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type the name above to confirm").fill(renamed);
    await confirm.click();
    await expect(
      page.getByRole("status").filter({ hasText: `${renamed} was deleted.` }),
    ).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(renamed) })).toHaveCount(0);
  });

  test("laptop: a university that students or departments use cannot be deleted", async ({
    page,
  }) => {
    test.skip(
      !referencedUniversity,
      "Needs E2E_REFERENCED_UNIVERSITY, a university with departments",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);

    await page.goto("/directory/universities");
    await page
      .getByRole("row", { name: new RegExp(referencedUniversity ?? "") })
      .getByRole("button", { name: "Delete" })
      .click();
    await page.getByLabel("Type the name above to confirm").fill(referencedUniversity ?? "");
    await page.getByRole("button", { name: "Delete university" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Archive it instead" })).toBeVisible();
  });

  test("phone: rows switch to the card list and stay usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await page.goto("/directory/universities");

    await expect(page.getByRole("heading", { name: "Universities" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add university" })).toBeVisible();
    await expect(page.getByLabel("Search universities")).toBeVisible();
  });
});
