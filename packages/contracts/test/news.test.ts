import { describe, expect, test } from "vitest";
import {
  dhakaLocalToIso,
  isKnownCacheTag,
  isoToDhakaLocal,
  newsPostCacheTag,
  newsPostRequestSchema,
} from "../src";

const body = { type: "doc", content: [{ type: "paragraph", content: [] }] };

const validRequest = {
  title: "Orientation week",
  schemaVersion: 1,
  body,
  status: "draft",
};

describe("newsPostRequestSchema", () => {
  test("accepts a draft without a publish date", () => {
    const parsed = newsPostRequestSchema.parse(validRequest);
    expect(parsed.publishedAt).toBeNull();
  });

  test("accepts a publish date with an offset", () => {
    const result = newsPostRequestSchema.safeParse({
      ...validRequest,
      status: "published",
      publishedAt: "2026-12-01T09:00:00+06:00",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an image without alt text", () => {
    const image = {
      type: "image",
      attrs: { assetId: "0198f6a0-0000-7000-8000-000000000001", alt: "  " },
    };
    const result = newsPostRequestSchema.safeParse({
      ...validRequest,
      body: { type: "doc", content: [image] },
    });
    expect(result.success).toBe(false);
  });

  test("rejects a javascript link", () => {
    const text = {
      type: "text",
      text: "x",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    };
    const result = newsPostRequestSchema.safeParse({
      ...validRequest,
      body: { type: "doc", content: [{ type: "paragraph", content: [text] }] },
    });
    expect(result.success).toBe(false);
  });

  test("rejects an empty title", () => {
    expect(newsPostRequestSchema.safeParse({ ...validRequest, title: "  " }).success).toBe(false);
  });
});

describe("Asia/Dhaka local time", () => {
  test("converts a local date and time to the UTC instant", () => {
    expect(dhakaLocalToIso("2026-12-01T09:00")).toBe("2026-12-01T03:00:00.000Z");
  });

  test("converts an instant back to local fields", () => {
    expect(isoToDhakaLocal("2026-12-01T03:00:00.000Z")).toBe("2026-12-01T09:00");
    expect(isoToDhakaLocal(null)).toBe("");
  });

  test("rejects text that is not a local date and time", () => {
    expect(dhakaLocalToIso("tomorrow")).toBeNull();
    expect(dhakaLocalToIso("")).toBeNull();
  });
});

describe("news cache tags", () => {
  test("knows the list tag and one tag per post", () => {
    expect(isKnownCacheTag("news")).toBe(true);
    expect(isKnownCacheTag(newsPostCacheTag("orientation-week"))).toBe(true);
    expect(isKnownCacheTag("news:Bad Slug")).toBe(false);
  });
});
