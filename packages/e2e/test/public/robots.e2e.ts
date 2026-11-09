import { expect, test } from "@playwright/test";

test.describe("the public site stays indexable", () => {
  for (const path of ["/", "/not-a-real-page"]) {
    test(`${path} has no X-Robots-Tag`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.headers()["x-robots-tag"]).toBeUndefined();
    });
  }
});
