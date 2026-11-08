import { expect, test, type Page } from "@playwright/test";

const nav = (page: Page, name: string) => page.getByRole("navigation", { name });

test.describe("language switch", () => {
  test("keeps the page, query and hash, stores the choice, and the next visit to / follows it", async ({
    page,
    context,
  }) => {
    await page.goto("/en/courses/x?tab=2#notes");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    const switcher = nav(page, "Language");
    await expect(switcher.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await switcher.getByRole("link", { name: "বাংলা" }).click();

    await expect(page).toHaveURL(/\/bn\/courses\/x\?tab=2#notes$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(nav(page, "ভাষা").getByRole("link", { name: "বাংলা" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    const cookies = await context.cookies();
    const stored = cookies.find((cookie) => cookie.name === "__Host-locale");
    expect(stored).toMatchObject({
      value: "bn",
      path: "/",
      sameSite: "Lax",
      secure: true,
      httpOnly: false,
    });
    expect(stored?.domain).toBe("127.0.0.1");
    expect((stored?.expires ?? 0) - Date.now() / 1000).toBeGreaterThan(364 * 86400);

    const response = await page.request.get("/", {
      maxRedirects: 0,
      headers: { "Accept-Language": "en" },
    });
    expect(response.headers()["location"]).toBe("/bn");
  });

  test("switches back to English the same way", async ({ page }) => {
    await page.goto("/bn/courses/x?tab=2#notes");
    await nav(page, "ভাষা").getByRole("link", { name: "English" }).click();
    await expect(page).toHaveURL(/\/en\/courses\/x\?tab=2#notes$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("works from the keyboard", async ({ page }) => {
    await page.goto("/en");
    await page.keyboard.press("Tab");
    await expect(nav(page, "Language").getByRole("link", { name: "বাংলা" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/bn$/);
  });

  test("a shared /en link wins over a saved Bangla choice", async ({ page, context }) => {
    await page.goto("/en");
    await nav(page, "Language").getByRole("link", { name: "বাংলা" }).click();
    await expect(page).toHaveURL(/\/bn$/);
    await page.goto("/en/courses/x");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect((await context.cookies()).find((cookie) => cookie.name === "__Host-locale")?.value).toBe(
      "bn",
    );
  });
});
