import { mediaLimits, mediaVariantWidths } from "@heat/contracts";
import type { MediaUploadFields } from "@heat/contracts";
import { ApiException } from "../http/api-exception";
import { isImageType } from "./media-sniff";
import type { SniffedType } from "./media-sniff";

export const assertWithinSize = (
  kind: MediaUploadFields["kind"],
  type: SniffedType | null,
  size: number,
): void => {
  const limit =
    kind === "image"
      ? mediaLimits.imageBytes
      : type === "text/vtt"
        ? mediaLimits.captionBytes
        : mediaLimits.documentBytes;
  if (size > limit) throw new ApiException(413, "UPLOAD_TOO_LARGE");
};

export const assertTypeMatchesKind = (
  kind: MediaUploadFields["kind"],
  type: SniffedType | null,
): SniffedType => {
  if (type === null) throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
  if ((kind === "image") !== isImageType(type)) {
    throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
  }
  return type;
};

export const assertAltText = (fields: MediaUploadFields): void => {
  if (fields.kind !== "image" || fields.crop === "square") return;
  if (fields.altText === undefined) {
    throw new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
      { path: "altText", code: "required" },
    ]);
  }
};

export const assertPixelLimit = (width: number, height: number): void => {
  if (width * height > mediaLimits.maxPixels) {
    throw new ApiException(413, "UPLOAD_DIMENSIONS_TOO_LARGE");
  }
};

export const variantWidths = (sourceWidth: number): number[] => {
  const ladder = mediaVariantWidths.filter((width) => width <= sourceWidth);
  const largest = mediaVariantWidths[mediaVariantWidths.length - 1] ?? 0;
  const top = ladder[ladder.length - 1];
  if (top === undefined) return [sourceWidth];
  return sourceWidth > top && sourceWidth < largest ? [...ladder, sourceWidth] : ladder;
};

export const squareVariantWidths = (width: number, height: number): number[] =>
  variantWidths(Math.min(width, height));

export const mediaKey = (visibility: string, now: Date, id: string): string => {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${visibility}/${year}/${month}/${id}`;
};

export const documentExtension = (type: SniffedType): string => {
  if (type === "application/pdf") return "pdf";
  if (type === "text/vtt") return "vtt";
  return type.includes("wordprocessingml") ? "docx" : "pptx";
};

export const mimeOfFile = (file: string, original: string): string => {
  if (file.endsWith(".webp")) return "image/webp";
  if (file.endsWith(".avif")) return "image/avif";
  return original;
};

export const canReadPrivate = (
  viewer: { userId: string; admin: boolean },
  uploaderId: string,
): boolean => viewer.admin || viewer.userId === uploaderId;
