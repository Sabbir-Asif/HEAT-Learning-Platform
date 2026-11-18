import { describe, expect, test } from "vitest";
import type { AppConfig } from "../../src/core";
import { mediaSignature } from "../../src/media/media-signing";
import { MediaUrlService } from "../../src/media/media-url.service";
import type { MediaAssetRecord } from "../../src/media/media-url.service";

const secret = "k".repeat(40);
const now = new Date("2026-11-12T00:00:00.000Z");

const service = (hls: AppConfig["hls"] = { keys: new Map([["k1", secret]]), activeKeyId: "k1" }) =>
  new MediaUrlService({ hls } as AppConfig, { now: () => now });

const asset = (visibility: MediaAssetRecord["visibility"]): MediaAssetRecord => ({
  id: "0194f3a0-0000-7000-8000-000000000001",
  key: `${visibility.toLowerCase()}/2026/11/0194f3a0-0000-7000-8000-0000000000aa`,
  kind: "IMAGE",
  visibility,
  mimeType: "image/webp",
  sizeBytes: 10,
  width: 640,
  height: 480,
  altText: "Hall",
  variants: [
    { name: "w320", file: "w320.webp", format: "webp", width: 320, height: 240, sizeBytes: 4 },
    { name: "w640", file: "w640.webp", format: "webp", width: 640, height: 480, sizeBytes: 6 },
    { name: "w640-avif", file: "w640.avif", format: "avif", width: 640, height: 480, sizeBytes: 3 },
  ],
});

describe("MediaUrlService", () => {
  test("public files are plain cacheable paths", () => {
    const url = service().fileUrl(asset("PUBLIC"), "w320.webp");

    expect(url).toBe("/media/public/2026/11/0194f3a0-0000-7000-8000-0000000000aa/w320.webp");
  });

  test("protected files carry an hour-long signature bound to the path", () => {
    const url = service().fileUrl(asset("PROTECTED"), "w320.webp");
    const [path, query] = url.split("?");
    const params = new URLSearchParams(query);
    const expiry = Number(params.get("e"));

    expect(expiry).toBe(Math.floor(now.getTime() / 1000) + 3600);
    expect(params.get("k")).toBe("k1");
    expect(params.get("s")).toBe(mediaSignature(secret, path ?? "", expiry));
    expect(params.get("s")).not.toBe(mediaSignature(secret, "/media/protected/other", expiry));
  });

  test("private files go through the API, by audience", () => {
    expect(service().fileUrl(asset("PRIVATE"), "w320.webp")).toBe(
      "/api/media/0194f3a0-0000-7000-8000-000000000001/w320.webp",
    );
    expect(service().fileUrl(asset("PRIVATE"), "w320.webp", "admin")).toBe(
      "/api/admin/media/0194f3a0-0000-7000-8000-000000000001/w320.webp",
    );
  });

  test("describe picks the largest WebP as the main url and lists every variant", () => {
    const described = service().describe(asset("PUBLIC"));

    expect(described.url).toMatch(/w640\.webp$/);
    expect(described.variants).toHaveLength(3);
    expect(described.kind).toBe("image");
  });

  test("signing a protected file without keys fails loudly", () => {
    const unsigned = new MediaUrlService({ hls: undefined } as AppConfig, { now: () => now });

    expect(() => unsigned.fileUrl(asset("PROTECTED"), "w320.webp")).toThrow();
  });
});
