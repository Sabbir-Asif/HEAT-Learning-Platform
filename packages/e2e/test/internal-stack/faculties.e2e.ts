import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const referencedUniversity = process.env.E2E_REFERENCED_UNIVERSITY;
const referencedFaculty = process.env.E2E_REFERENCED_FACULTY;

const signIn = async (page: Page) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
};

test.describe("faculty directory", () => {
  test.skip(
    !email || !password,
    "Needs the real stack, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD of a super admin who has already set a password",
  );

  test("laptop: create a faculty, assign it to a university, unassign it and delete it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const stamp = String(Date.now());
    const universityName = `E2E Faculty Host ${stamp}`;
    const name = `E2E Faculty ${stamp}`;

    await page.goto("/directory/universities");
    await page.getByRole("button", { name: "Add university" }).click();
    await page.getByLabel("Name").fill(universityName);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `${universityName} was added.` }),
    ).toBeVisible();

    await page.goto("/directory/faculties");
    await page.getByRole("button", { name: "Add faculty" }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel(universityName).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} was added.` })).toBeVisible();

    await page.getByLabel("Search faculties").fill(name);
    await expect(page).toHaveURL(/q=/);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText(universityName);

    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByLabel("Type the name above to confirm").fill(name);
    await page.getByRole("button", { name: "Delete faculty" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Archive it instead" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await row.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel(universityName).uncheck();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} was saved.` })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toContainText("None");

    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByRole("button", { name: "Delete" })
      .click();
    const confirm = page.getByRole("button", { name: "Delete faculty" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type the name above to confirm").fill(name);
    await confirm.click();
    await expect(
      page.getByRole("status").filter({ hasText: `${name} was deleted.` }),
    ).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  });

  test("laptop: a faculty cannot be removed from a university that has departments of it", async ({
    page,
  }) => {
    test.skip(
      !referencedUniversity || !referencedFaculty,
      "Needs E2E_REFERENCED_FACULTY and E2E_REFERENCED_UNIVERSITY, a faculty with departments at that university",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);

    await page.goto("/directory/faculties");
    await page.getByLabel("Search faculties").fill(referencedFaculty ?? "");
    await page
      .getByRole("row", { name: new RegExp(referencedFaculty ?? "") })
      .getByRole("button", { name: "Edit" })
      .click();
    await page.getByLabel(referencedUniversity ?? "").uncheck();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "still has departments at" }).first(),
    ).toBeVisible();
  });

  test("phone: rows switch to the card list and stay usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await page.goto("/directory/faculties");

    await expect(page.getByRole("heading", { name: "Faculties" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add faculty" })).toBeVisible();
    await expect(page.getByLabel("Search faculties")).toBeVisible();
  });
});
