import sharp from "sharp";
import { describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { SharpImageProcessor } from "../../src/media/image-processor";

const processor = new SharpImageProcessor();

const jpeg = (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: "#336699" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "private owner" } })
    .toBuffer();

describe("SharpImageProcessor", () => {
  test("an 800 px image gets 320, 640 and 800 px WebP variants and nothing wider", async () => {
    const result = await processor.process(await jpeg(800, 600), { crop: "none", avif: false });

    expect(result.files.map((file) => file.width)).toEqual([320, 640, 800]);
    expect(result.files.every((file) => file.format === "webp")).toBe(true);
    expect(result.width).toBe(800);
  });

  test("every stored variant is free of EXIF metadata", async () => {
    const result = await processor.process(await jpeg(800, 600), { crop: "none", avif: true });

    expect(result.files.some((file) => file.format === "avif")).toBe(true);
    for (const file of result.files) {
      const metadata = await sharp(file.bytes).metadata();
      expect(metadata.exif).toBeUndefined();
    }
  });

  test("a profile crop is square", async () => {
    const result = await processor.process(await jpeg(1000, 600), { crop: "square", avif: false });

    for (const file of result.files) expect(file.width).toBe(file.height);
    expect(result.files.some((file) => file.format === "avif")).toBe(false);
  });

  test("corrupt image bytes are refused as an unsupported type", async () => {
    const failure = await processor
      .process(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)]), {
        crop: "none",
        avif: false,
      })
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("UPLOAD_TYPE_NOT_ALLOWED");
  });

  test("an image above the pixel limit is refused from its header before decoding", async () => {
    const huge = await sharp({
      create: { width: 8000, height: 6000, channels: 3, background: "#000" },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const failure = await processor
      .process(huge, { crop: "none", avif: false })
      .catch((error: unknown) => error);

    expect((failure as ApiException).code).toBe("UPLOAD_DIMENSIONS_TOO_LARGE");
  });
});
