import { ApiException } from "../../src/http/api-exception";
import { describe, expect, test } from "vitest";
import {
  assertContentType,
  assertOffsetMatches,
  assertTusVersion,
  assertVideoBytes,
  isUploadExpired,
  newAssetKey,
  parseUploadLength,
  parseUploadOffset,
} from "../../src/catalog/video-upload-rules";

const codeOf = (run: () => unknown): { status: number; code: string } | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiException) return { status: error.getStatus(), code: error.code };
    throw error;
  }
  return undefined;
};

const maxBytes = 1000;

describe("parseUploadLength", () => {
  test("accepts a length inside the limits", () => {
    expect(parseUploadLength("500", maxBytes)).toBe(500);
  });

  test("refuses a missing or malformed length", () => {
    expect(codeOf(() => parseUploadLength(undefined, maxBytes))).toEqual({
      status: 400,
      code: "BAD_REQUEST",
    });
    for (const bad of ["", "-1", "1.5", "abc", "1e3", "0x10", " 5"]) {
      expect(codeOf(() => parseUploadLength(bad, maxBytes))?.code).toBe("BAD_REQUEST");
    }
  });

  test("refuses a length over the cap", () => {
    expect(codeOf(() => parseUploadLength("1001", maxBytes))).toEqual({
      status: 413,
      code: "UPLOAD_TOO_LARGE",
    });
  });

  test("refuses a file too small to hold a video header", () => {
    expect(codeOf(() => parseUploadLength("5", maxBytes))).toEqual({
      status: 415,
      code: "UPLOAD_TYPE_NOT_ALLOWED",
    });
  });
});

describe("parseUploadOffset", () => {
  test("reads a non negative integer", () => {
    expect(parseUploadOffset("0")).toBe(0);
    expect(parseUploadOffset("4096")).toBe(4096);
  });

  test("refuses anything else", () => {
    for (const bad of [undefined, "", "-3", "2.5", "x"]) {
      expect(codeOf(() => parseUploadOffset(bad))?.code).toBe("BAD_REQUEST");
    }
  });
});

describe("tus headers", () => {
  test("requires protocol version 1.0.0", () => {
    expect(codeOf(() => assertTusVersion("1.0.0"))).toBeUndefined();
    expect(codeOf(() => assertTusVersion(undefined))).toEqual({ status: 412, code: "BAD_REQUEST" });
    expect(codeOf(() => assertTusVersion("0.2.2"))?.status).toBe(412);
  });

  test("requires the offset octet stream content type", () => {
    expect(codeOf(() => assertContentType("application/offset+octet-stream"))).toBeUndefined();
    expect(codeOf(() => assertContentType("video/mp4"))).toEqual({
      status: 415,
      code: "UPLOAD_TYPE_NOT_ALLOWED",
    });
    expect(codeOf(() => assertContentType(undefined))?.status).toBe(415);
  });

  test("a stale offset conflicts", () => {
    expect(codeOf(() => assertOffsetMatches(10, 10))).toBeUndefined();
    expect(codeOf(() => assertOffsetMatches(10, 4))).toEqual({
      status: 409,
      code: "UPLOAD_OFFSET_MISMATCH",
    });
  });
});

describe("assertVideoBytes", () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(8)]);
  const mov = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypqt  "), Buffer.alloc(8)]);
  const matroska = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(12)]);

  test("accepts MP4, MOV and Matroska or WebM signatures", () => {
    for (const head of [mp4, mov, matroska]) {
      expect(codeOf(() => assertVideoBytes(head))).toBeUndefined();
    }
  });

  test("refuses other content whatever its name claims", () => {
    const refused = [
      Buffer.from("%PDF-1.7 not a video"),
      Buffer.from("MZ\u0090\u0000 executable"),
      Buffer.from("GIF89a..........."),
      Buffer.alloc(16),
      Buffer.from("ftyp"),
    ];
    for (const head of refused) {
      expect(codeOf(() => assertVideoBytes(head))).toEqual({
        status: 415,
        code: "UPLOAD_TYPE_NOT_ALLOWED",
      });
    }
  });
});

describe("isUploadExpired", () => {
  const created = new Date("2026-11-11T00:00:00.000Z");

  test("is false inside the window and true after it", () => {
    expect(isUploadExpired(created, new Date("2026-11-11T23:59:59.000Z"), 24)).toBe(false);
    expect(isUploadExpired(created, new Date("2026-11-12T00:00:01.000Z"), 24)).toBe(true);
  });
});

describe("newAssetKey", () => {
  test("is 32 url safe characters taken from the random source", () => {
    const key = newAssetKey((size) => Buffer.alloc(size, 0xfb));
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  test("differs between calls with a real random source", () => {
    const random = (size: number) =>
      Buffer.from(Array.from({ length: size }, () => Math.floor(Math.random() * 256)));
    expect(newAssetKey(random)).not.toBe(newAssetKey(random));
  });
});
