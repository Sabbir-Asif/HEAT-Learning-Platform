import { expect, test, type APIRequestContext } from "@playwright/test";

const get = (request: APIRequestContext, headers: Record<string, string> = {}, path = "/") =>
  request.get(path, { headers, maxRedirects: 0 });

test.describe("GET /", () => {
  test("sends en-US,en;q=0.9 to /en with the cache headers", async ({ request }) => {
    const response = await get(request, { "Accept-Language": "en-US,en;q=0.9" });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toBe("/en");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect(response.headers()["vary"]).toBe("Accept-Language, Cookie");
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  for (const acceptLanguage of ["fr", "*", ""]) {
    test(`sends Accept-Language ${JSON.stringify(acceptLanguage)} to /bn`, async ({ request }) => {
      const response = await get(request, { "Accept-Language": acceptLanguage });
      expect(response.status()).toBe(307);
      expect(response.headers()["location"]).toBe("/bn");
    });
  }

  test("sends a request without Accept-Language to /bn", async ({ request }) => {
    const response = await request.get("/", {
      maxRedirects: 0,
      headers: { "Accept-Language": "" },
    });
    expect(response.headers()["location"]).toBe("/bn");
  });

  test("honours q-values", async ({ request }) => {
    const response = await get(request, { "Accept-Language": "en;q=0.8, bn;q=0.9" });
    expect(response.headers()["location"]).toBe("/bn");
  });

  test("lets the locale cookie win over Accept-Language", async ({ request }) => {
    const response = await get(request, { Cookie: "__Host-locale=bn", "Accept-Language": "en" });
    expect(response.headers()["location"]).toBe("/bn");
  });

  for (const value of ["fr", "BN", ""]) {
    test(`ignores the cookie value ${JSON.stringify(value)}`, async ({ request }) => {
      const response = await get(request, {
        Cookie: `__Host-locale=${value}`,
        "Accept-Language": "en",
      });
      expect(response.headers()["location"]).toBe("/en");
    });
  }

  for (const query of ["utm_source=a%20b&x=%E0%A6%AC", "a=1&a=2&", "a=%zz", "q=%2B+%20"]) {
    test(`keeps the parsed values of the query ?${query}`, async ({ request }) => {
      const response = await get(request, { "Accept-Language": "en" }, `/?${query}`);
      const location = new URL(response.headers()["location"] ?? "", "http://learn.test");
      expect(location.pathname).toBe("/en");
      expect([...location.searchParams]).toEqual([...new URLSearchParams(query)]);
    });
  }

  test("never puts a forged Host header in the response", async ({ request }) => {
    const response = await get(request, { Host: "evil.example" });
    expect(response.headers()["location"]).toBe("/bn");
    expect(JSON.stringify(response.headers())).not.toContain("evil.example");
  });

  for (const hostile of [
    "https://evil.example/en",
    "//evil.example",
    "en;q=0.5,https://evil.example",
  ]) {
    test(`never echoes the Accept-Language value ${hostile}`, async ({ request }) => {
      const response = await get(request, { "Accept-Language": hostile });
      expect(["/en", "/bn"]).toContain(response.headers()["location"]);
      expect(JSON.stringify(response.headers())).not.toContain("evil.example");
    });
  }
});

test.describe("in a browser", () => {
  test.describe("with an English browser", () => {
    test.use({ locale: "en-US" });

    test("lands on /en", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/en$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  });

  test.describe("with a browser that asks for French", () => {
    test.use({ locale: "fr-FR" });

    test("lands on /bn", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/bn$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    });
  });
});
