import { expect, test } from "@playwright/test";

test.describe("search engines are kept out of the admin console", () => {
  for (const path of ["/", "/not-a-real-page"]) {
    test(`${path} answers with X-Robots-Tag noindex`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"]).toContain("noindex");
    });
  }

  test("a static asset answers with X-Robots-Tag noindex", async ({ request, page }) => {
    await page.goto("/");
    const asset = await page.evaluate(
      () => document.querySelector<HTMLScriptElement>("script[src*='/_next/static/']")?.src,
    );
    expect(asset).toBeTruthy();
    const response = await request.get(asset ?? "");
    expect(response.ok()).toBe(true);
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  });
});
