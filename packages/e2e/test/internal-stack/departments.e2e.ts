import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const referencedDepartment = process.env.E2E_REFERENCED_DEPARTMENT;

const signIn = async (page: Page) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email ?? "");
  await page.getByLabel("Password").fill(password ?? "");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
};

const choose = async (
  page: Page,
  scope: ReturnType<Page["getByRole"]>,
  label: string,
  option: string,
) => {
  await scope.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

test.describe("department directory", () => {
  test.skip(
    !email || !password,
    "Needs the real stack, E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD of a super admin who has already set a password",
  );

  test("laptop: cascading selects, create, filter and delete a department", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    const stamp = String(Date.now());
    const hosted = `E2E Dept Host ${stamp}`;
    const bare = `E2E Dept Bare ${stamp}`;
    const facultyName = `E2E Dept Faculty ${stamp}`;
    const name = `E2E Department ${stamp}`;

    for (const universityName of [hosted, bare]) {
      await page.goto("/directory/universities");
      await page.getByRole("button", { name: "Add university" }).click();
      await page.getByLabel("Name").fill(universityName);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: `${universityName} was added.` }),
      ).toBeVisible();
    }

    await page.goto("/directory/faculties");
    await page.getByRole("button", { name: "Add faculty" }).click();
    await page.getByLabel("Name", { exact: true }).fill(facultyName);
    await page.getByLabel(hosted).check();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: `${facultyName} was added.` }),
    ).toBeVisible();

    await page.goto("/directory/departments");
    await page.getByRole("button", { name: "Add department" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("combobox", { name: "Faculty" })).toBeDisabled();
    await choose(page, sheet, "University", bare);
    await expect(sheet.getByText("offers no faculty yet")).toBeVisible();

    await choose(page, sheet, "University", hosted);
    await sheet.getByRole("combobox", { name: "Faculty" }).click();
    await expect(page.getByRole("option")).toHaveText([facultyName]);
    await page.getByRole("option", { name: facultyName }).click();
    await sheet.getByLabel("Name", { exact: true }).fill(name);
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${name} was added.` })).toBeVisible();

    await page.getByLabel("Search departments").fill(name);
    const row = page.getByRole("row", { name: new RegExp(name) });
    await expect(row).toContainText(hosted);
    await expect(row).toContainText(facultyName);

    await page.getByLabel("Search departments").fill("");
    await choose(page, page.locator("main"), "University", hosted);
    await expect(page).toHaveURL(/university=/);
    await expect(page.getByRole("combobox", { name: "Faculty" })).toBeEnabled();
    await choose(page, page.locator("main"), "Faculty", facultyName);
    await expect(page.getByRole("row", { name: new RegExp(name) })).toBeVisible();

    await page
      .getByRole("row", { name: new RegExp(name) })
      .getByRole("button", { name: "Delete" })
      .click();
    const confirm = page.getByRole("button", { name: "Delete department" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel("Type the name above to confirm").fill(name);
    await confirm.click();
    await expect(
      page.getByRole("status").filter({ hasText: `${name} was deleted.` }),
    ).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  });

  test("laptop: a department with students cannot be deleted", async ({ page }) => {
    test.skip(
      !referencedDepartment,
      "Needs E2E_REFERENCED_DEPARTMENT, the name of a department that students reference",
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);

    await page.goto("/directory/departments");
    await page.getByLabel("Search departments").fill(referencedDepartment ?? "");
    await page
      .getByRole("row", { name: new RegExp(referencedDepartment ?? "") })
      .first()
      .getByRole("button", { name: "Delete" })
      .click();
    await page.getByLabel("Type the name above to confirm").fill(referencedDepartment ?? "");
    await page.getByRole("button", { name: "Delete department" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Archive it instead" })).toBeVisible();
  });

  test("phone: rows switch to the card list and stay usable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await page.goto("/directory/departments");

    await expect(page.getByRole("heading", { name: "Departments" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add department" })).toBeVisible();
    await expect(page.getByLabel("Search departments")).toBeVisible();
  });
});
