import { z } from "zod";

const mebibyte = 1024 * 1024;

export const mediaLimits = {
  imageBytes: 10 * mebibyte,
  documentBytes: 25 * mebibyte,
  captionBytes: 1 * mebibyte,
  maxPixels: 40_000_000,
  signedUrlSeconds: 3600,
  unlinkedRetentionHours: 24,
} as const;

export const mediaVariantWidths = [320, 640, 1280, 1920] as const;

export const mediaKinds = ["image", "document"] as const;

export const mediaVisibilities = ["public", "protected", "private"] as const;

export const mediaImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

export const mediaDocumentTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/vtt",
] as const;

export const mediaUploadFieldsSchema = z.object({
  kind: z.enum(mediaKinds),
  visibility: z.enum(mediaVisibilities),
  altText: z.string().trim().min(1).max(300).optional(),
  crop: z.enum(["none", "square"]).default("none"),
});

export type MediaUploadFields = z.infer<typeof mediaUploadFieldsSchema>;

export const mediaVariantSchema = z.object({
  name: z.string(),
  file: z.string(),
  format: z.enum(["webp", "avif", "original"]),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  sizeBytes: z.number().int().nonnegative(),
});

export type MediaVariant = z.infer<typeof mediaVariantSchema>;

export const mediaVariantsSchema = z.array(mediaVariantSchema);

export const mediaAssetResponseSchema = z.object({
  id: z.uuid(),
  kind: z.enum(mediaKinds),
  visibility: z.enum(mediaVisibilities),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  altText: z.string().nullable(),
  url: z.string(),
  variants: z.array(
    z.object({
      name: z.string(),
      format: z.enum(["webp", "avif", "original"]),
      width: z.number().int().positive().nullable(),
      url: z.string(),
    }),
  ),
});

export type MediaAssetResponse = z.infer<typeof mediaAssetResponseSchema>;

export const mediaFileParamsSchema = z.object({
  id: z.uuid(),
  file: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
});

export const mediaPublicPath = "/media/public";
export const mediaProtectedPath = "/media/protected";

export const nearestMediaWidth = (requested: number): number => {
  const fitting = mediaVariantWidths.find((width) => width >= requested);
  return fitting ?? mediaVariantWidths[mediaVariantWidths.length - 1] ?? requested;
};

const variantFile = /\/w\d+\.(webp|avif)(\?.*)?$/;

export const mediaImageUrl = (source: string, requested: number): string =>
  source.replace(variantFile, (_match, format: string, query: string | undefined) => {
    return `/w${nearestMediaWidth(requested)}.${format}${query ?? ""}`;
  });
