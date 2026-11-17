import { mediaLimits } from "@heat/contracts";
import sharp from "sharp";
import { ApiException } from "../http/api-exception";
import { assertPixelLimit, squareVariantWidths, variantWidths } from "./media-rules";

export interface ProcessedImageFile {
  name: string;
  file: string;
  format: "webp" | "avif";
  width: number;
  height: number;
  bytes: Buffer;
}

export interface ProcessedImage {
  width: number;
  height: number;
  files: ProcessedImageFile[];
}

export interface ImageProcessingOptions {
  crop: "none" | "square";
  avif: boolean;
}

export interface ImageProcessor {
  process(bytes: Buffer, options: ImageProcessingOptions): Promise<ProcessedImage>;
}

export const IMAGE_PROCESSOR = Symbol("IMAGE_PROCESSOR");

const webpQuality = 80;
const avifQuality = 55;
const swappedOrientations = new Set([5, 6, 7, 8]);

const open = (bytes: Buffer): sharp.Sharp =>
  sharp(bytes, { limitInputPixels: mediaLimits.maxPixels, failOn: "error" });

const decodeFailure = (error: unknown): ApiException => {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("pixel limit")) return new ApiException(413, "UPLOAD_DIMENSIONS_TOO_LARGE");
  return new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
};

const orientedSize = (metadata: sharp.Metadata): { width: number; height: number } => {
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  return swappedOrientations.has(metadata.orientation ?? 1)
    ? { width: height, height: width }
    : { width, height };
};

export class SharpImageProcessor implements ImageProcessor {
  async process(bytes: Buffer, options: ImageProcessingOptions): Promise<ProcessedImage> {
    try {
      return await this.render(bytes, options);
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw decodeFailure(error);
    }
  }

  private async render(bytes: Buffer, options: ImageProcessingOptions): Promise<ProcessedImage> {
    const { width, height } = orientedSize(await open(bytes).metadata());
    if (width < 1 || height < 1) throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
    assertPixelLimit(width, height);
    const widths =
      options.crop === "square" ? squareVariantWidths(width, height) : variantWidths(width);
    const formats: Array<"webp" | "avif"> = options.avif ? ["webp", "avif"] : ["webp"];
    const files: ProcessedImageFile[] = [];
    for (const target of widths) {
      for (const format of formats) {
        files.push(await this.variant(bytes, target, format, options.crop));
      }
    }
    const largest = files.reduce((best, file) => (file.width > best.width ? file : best));
    return { width: largest.width, height: largest.height, files };
  }

  private async variant(
    bytes: Buffer,
    target: number,
    format: "webp" | "avif",
    crop: "none" | "square",
  ): Promise<ProcessedImageFile> {
    const pipeline = open(bytes)
      .rotate()
      .resize({
        width: target,
        height: crop === "square" ? target : undefined,
        fit: crop === "square" ? "cover" : "inside",
        withoutEnlargement: true,
      });
    const encoded =
      format === "webp"
        ? pipeline.webp({ quality: webpQuality })
        : pipeline.avif({ quality: avifQuality });
    const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
    return {
      name: format === "webp" ? `w${target}` : `w${target}-avif`,
      file: `w${target}.${format}`,
      format,
      width: info.width,
      height: info.height,
      bytes: data,
    };
  }
}
