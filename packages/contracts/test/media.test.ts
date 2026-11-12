import { describe, expect, test } from "vitest";
import { mediaImageUrl, mediaUploadFieldsSchema, nearestMediaWidth } from "../src/media";

describe("nearestMediaWidth", () => {
  test("picks the smallest pre-generated width that covers the request", () => {
    expect(nearestMediaWidth(100)).toBe(320);
    expect(nearestMediaWidth(320)).toBe(320);
    expect(nearestMediaWidth(321)).toBe(640);
    expect(nearestMediaWidth(1500)).toBe(1920);
    expect(nearestMediaWidth(5000)).toBe(1920);
  });
});

describe("mediaImageUrl", () => {
  test("swaps the variant file and keeps the signature query", () => {
    expect(mediaImageUrl("/media/public/2026/11/a/w1920.webp", 600)).toBe(
      "/media/public/2026/11/a/w640.webp",
    );
    expect(mediaImageUrl("/media/protected/2026/11/a/w640.avif?k=k1&e=1&s=ab", 300)).toBe(
      "/media/protected/2026/11/a/w320.avif?k=k1&e=1&s=ab",
    );
  });

  test("leaves other urls alone", () => {
    expect(mediaImageUrl("/static/logo.png", 640)).toBe("/static/logo.png");
  });
});

describe("mediaUploadFieldsSchema", () => {
  test("defaults the crop and trims alt text", () => {
    expect(
      mediaUploadFieldsSchema.parse({ kind: "image", visibility: "public", altText: " Hall " }),
    ).toEqual({ kind: "image", visibility: "public", altText: "Hall", crop: "none" });
  });

  test("rejects unknown visibility or kind", () => {
    expect(mediaUploadFieldsSchema.safeParse({ kind: "video", visibility: "public" }).success).toBe(
      false,
    );
    expect(mediaUploadFieldsSchema.safeParse({ kind: "image", visibility: "open" }).success).toBe(
      false,
    );
  });
});
