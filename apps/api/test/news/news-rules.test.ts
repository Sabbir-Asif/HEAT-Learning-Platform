import { describe, expect, test } from "vitest";
import {
  coverAssetIdOf,
  newsState,
  pickSlug,
  planPublishedAt,
  slugStem,
  summaryOf,
} from "../../src/news/news-rules";

const now = new Date("2026-11-12T06:00:00.000Z");

describe("slugs", () => {
  test("builds a lowercase hyphenated stem and strips accents", () => {
    expect(slugStem("  Café Safety: Week 1! ")).toBe("cafe-safety-week-1");
  });

  test("falls back when the title has no usable characters", () => {
    expect(slugStem("!!!")).toBe("post");
  });

  test("gives two posts with the same title different slugs", () => {
    const first = pickSlug("Orientation", new Set());
    const second = pickSlug("Orientation", new Set([first]));
    const third = pickSlug("Orientation", new Set([first, second]));
    expect([first, second, third]).toEqual(["orientation", "orientation-2", "orientation-3"]);
  });
});

describe("publication state", () => {
  test("a post without a date is a draft", () => {
    expect(newsState(null, now)).toBe("draft");
  });

  test("a future date is scheduled and becomes published once it passes", () => {
    const at = new Date("2026-11-12T08:00:00.000Z");
    expect(newsState(at, now)).toBe("scheduled");
    expect(newsState(at, new Date("2026-11-12T08:00:00.000Z"))).toBe("published");
  });

  test("a draft request clears the date", () => {
    expect(planPublishedAt({ status: "draft", publishedAt: "2026-12-01T00:00:00.000Z" }, now)).toBe(
      null,
    );
  });

  test("a published request without a date publishes now", () => {
    expect(planPublishedAt({ status: "published", publishedAt: null }, now)).toEqual(now);
  });

  test("saving a published post again keeps its existing date", () => {
    const current = new Date("2026-11-01T00:00:00.000Z");
    expect(planPublishedAt({ status: "published", publishedAt: null }, now, current)).toEqual(
      current,
    );
  });

  test("a published request keeps the chosen date", () => {
    const planned = planPublishedAt(
      { status: "published", publishedAt: "2026-12-01T09:00:00+06:00" },
      now,
    );
    expect(planned?.toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
});

describe("summary and cover", () => {
  const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
  const doc = {
    type: "doc" as const,
    content: [
      { type: "image" as const, attrs: { assetId, alt: "Cover" } },
      { type: "paragraph" as const, content: [{ type: "text" as const, text: "First   line" }] },
      { type: "paragraph" as const, content: [{ type: "text" as const, text: "Second" }] },
    ],
  };

  test("summarises the text without image nodes", () => {
    expect(summaryOf(doc)).toBe("First line Second");
  });

  test("truncates long text", () => {
    const long = {
      type: "doc" as const,
      content: [
        { type: "paragraph" as const, content: [{ type: "text" as const, text: "a".repeat(500) }] },
      ],
    };
    expect(summaryOf(long).length).toBe(200);
  });

  test("uses the first image as the cover", () => {
    expect(coverAssetIdOf(doc)).toBe(assetId);
    expect(coverAssetIdOf({ type: "doc", content: [] })).toBeNull();
  });
});
