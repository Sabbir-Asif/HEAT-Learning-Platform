import { describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import {
  assertAltText,
  assertPixelLimit,
  assertTypeMatchesKind,
  assertWithinSize,
  canReadPrivate,
  mediaKey,
  squareVariantWidths,
  variantWidths,
} from "../../src/media/media-rules";

const codeOf = (run: () => unknown): { status: number; code: string } | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiException) return { status: error.getStatus(), code: error.code };
    throw error;
  }
  return undefined;
};

const mebibyte = 1024 * 1024;

describe("variantWidths", () => {
  test("never upscales and ends at the source width", () => {
    expect(variantWidths(800)).toEqual([320, 640, 800]);
  });

  test("uses exact ladder widths when the source matches one", () => {
    expect(variantWidths(1280)).toEqual([320, 640, 1280]);
  });

  test("caps at 1920 for larger sources", () => {
    expect(variantWidths(4000)).toEqual([320, 640, 1280, 1920]);
    expect(variantWidths(1920)).toEqual([320, 640, 1280, 1920]);
  });

  test("a source narrower than the smallest rung yields one variant", () => {
    expect(variantWidths(200)).toEqual([200]);
  });

  test("square crops follow the shorter side", () => {
    expect(squareVariantWidths(2000, 700)).toEqual([320, 640, 700]);
  });
});

describe("assertTypeMatchesKind", () => {
  test("refuses bytes that are not allowed or do not fit the kind", () => {
    expect(codeOf(() => assertTypeMatchesKind("document", null))?.code).toBe(
      "UPLOAD_TYPE_NOT_ALLOWED",
    );
    expect(codeOf(() => assertTypeMatchesKind("document", "image/png"))).toEqual({
      status: 415,
      code: "UPLOAD_TYPE_NOT_ALLOWED",
    });
    expect(codeOf(() => assertTypeMatchesKind("image", "application/pdf"))?.code).toBe(
      "UPLOAD_TYPE_NOT_ALLOWED",
    );
  });

  test("accepts matching types", () => {
    expect(assertTypeMatchesKind("document", "application/pdf")).toBe("application/pdf");
    expect(assertTypeMatchesKind("image", "image/png")).toBe("image/png");
  });
});

describe("assertWithinSize", () => {
  test("images are capped at 10 MB, documents at 25 MB, captions at 1 MB", () => {
    expect(codeOf(() => assertWithinSize("image", "image/png", 10 * mebibyte))).toBeUndefined();
    expect(codeOf(() => assertWithinSize("image", "image/png", 10 * mebibyte + 1))).toEqual({
      status: 413,
      code: "UPLOAD_TOO_LARGE",
    });
    expect(
      codeOf(() => assertWithinSize("document", "application/pdf", 25 * mebibyte)),
    ).toBeUndefined();
    expect(
      codeOf(() => assertWithinSize("document", "application/pdf", 25 * mebibyte + 1))?.code,
    ).toBe("UPLOAD_TOO_LARGE");
    expect(codeOf(() => assertWithinSize("document", "text/vtt", mebibyte + 1))?.code).toBe(
      "UPLOAD_TOO_LARGE",
    );
  });
});

describe("assertPixelLimit", () => {
  test("rejects images above the pixel limit", () => {
    expect(codeOf(() => assertPixelLimit(8000, 5000))).toBeUndefined();
    expect(codeOf(() => assertPixelLimit(10000, 10000))).toEqual({
      status: 413,
      code: "UPLOAD_DIMENSIONS_TOO_LARGE",
    });
  });
});

describe("assertAltText", () => {
  test("content images need alt text, square profile crops and documents do not", () => {
    expect(
      codeOf(() => assertAltText({ kind: "image", visibility: "public", crop: "none" }))?.code,
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() =>
        assertAltText({ kind: "image", visibility: "public", crop: "none", altText: "A hall" }),
      ),
    ).toBeUndefined();
    expect(
      codeOf(() => assertAltText({ kind: "image", visibility: "private", crop: "square" })),
    ).toBeUndefined();
    expect(
      codeOf(() => assertAltText({ kind: "document", visibility: "public", crop: "none" })),
    ).toBeUndefined();
  });
});

describe("mediaKey and private access", () => {
  test("lays the key out by visibility, year and month", () => {
    expect(mediaKey("public", new Date("2026-11-12T00:00:00Z"), "abc")).toBe("public/2026/11/abc");
  });

  test("a private file is readable by its uploader and by admins only", () => {
    expect(canReadPrivate({ userId: "u1", admin: false }, "u1")).toBe(true);
    expect(canReadPrivate({ userId: "u2", admin: false }, "u1")).toBe(false);
    expect(canReadPrivate({ userId: "u2", admin: true }, "u1")).toBe(true);
  });
});
