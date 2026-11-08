import { expect, test } from "@playwright/test";

for (const [locale, heading] of [
  ["bn", "HEAT জেন্ডার নিরাপত্তা প্রশিক্ষণ"],
  ["en", "HEAT Gender Safety Training"],
] as const) {
  test.describe(`/${locale}`, () => {
    for (const path of [`/${locale}`, `/${locale}?tab=2`]) {
      test(`${path} sets lang and dir and takes the text from the catalog`, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
        await expect(page).toHaveTitle(heading);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      });
    }
  });
}

test.describe("paths with no page", () => {
  for (const path of [
    "/fr",
    "/fr/x",
    "/sign-in",
    "/BN",
    "/BN/x",
    "/EN/x",
    "/en-US",
    "/xx",
    "/bn/anything",
    "/en/courses/x",
  ]) {
    test(`${path} is a 404`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }
});

test.describe("static files", () => {
  for (const name of ["heat", "heat-dark", "gob", "ugc", "world-bank", "du-crest"]) {
    test(`/brand/${name}.svg is served without a redirect`, async ({ request }) => {
      const response = await request.get(`/brand/${name}.svg`, {
        maxRedirects: 0,
        headers: { Cookie: "__Host-locale=bn", "Accept-Language": "en" },
      });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/svg+xml");
      expect(response.headers()["location"]).toBeUndefined();
      expect(response.headers()["set-cookie"]).toBeUndefined();
    });
  }
});
