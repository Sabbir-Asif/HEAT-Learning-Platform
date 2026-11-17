import { describe, expect, test } from "vitest";
import { landingOverviewRequestSchema } from "../src/index";

const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
};

const request = (overrides: Record<string, unknown> = {}) => ({
  heading: "About the project",
  schemaVersion: 1,
  body,
  imageAssetId: null,
  ...overrides,
});

describe("landingOverviewRequestSchema", () => {
  test("accepts a heading, an allow-listed body and no image", () => {
    expect(landingOverviewRequestSchema.safeParse(request()).success).toBe(true);
  });

  test("trims the heading and rejects an empty one", () => {
    expect(landingOverviewRequestSchema.parse(request({ heading: "  Hello " })).heading).toBe(
      "Hello",
    );
    expect(landingOverviewRequestSchema.safeParse(request({ heading: "   " })).success).toBe(false);
  });

  test("rejects a link scheme outside the allow-list", () => {
    const unsafe = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    };
    expect(landingOverviewRequestSchema.safeParse(request({ body: unsafe })).success).toBe(false);
  });

  test("rejects a node outside the allow-list", () => {
    const unknown = { type: "doc", content: [{ type: "script" }] };
    expect(landingOverviewRequestSchema.safeParse(request({ body: unknown })).success).toBe(false);
  });

  test("rejects an image asset id that is not a uuid", () => {
    expect(landingOverviewRequestSchema.safeParse(request({ imageAssetId: "x" })).success).toBe(
      false,
    );
  });
});
