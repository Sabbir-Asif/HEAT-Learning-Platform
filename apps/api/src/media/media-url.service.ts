import { Inject, Injectable } from "@nestjs/common";
import { mediaLimits, mediaProtectedPath, mediaPublicPath } from "@heat/contracts";
import type { MediaAssetResponse, MediaVariant } from "@heat/contracts";
import { mediaVariantsSchema } from "@heat/contracts";
import { APP_CONFIG, CLOCK } from "../core";
import type { AppConfig, Clock } from "../core";
import { signedMediaUrl } from "./media-signing";

export interface MediaAssetRecord {
  id: string;
  key: string;
  kind: "IMAGE" | "DOCUMENT";
  visibility: "PUBLIC" | "PROTECTED" | "PRIVATE";
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  variants: unknown;
}

export type MediaAudience = "student" | "admin";

@Injectable()
export class MediaUrlService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  fileUrl(asset: MediaAssetRecord, file: string, audience: MediaAudience = "student"): string {
    const path = this.pathOf(asset, file, audience);
    if (asset.visibility !== "PROTECTED") return path;
    const hls = this.config.hls;
    if (hls === undefined) throw new Error("HLS_SIGNING_KEYS is required for protected media");
    const secret = hls.keys.get(hls.activeKeyId);
    if (secret === undefined) throw new Error("Active signing key is missing");
    const expiry = Math.floor(this.clock.now().getTime() / 1000) + mediaLimits.signedUrlSeconds;
    return signedMediaUrl(hls.activeKeyId, secret, path, expiry);
  }

  describe(asset: MediaAssetRecord, audience: MediaAudience = "student"): MediaAssetResponse {
    const variants = this.variantsOf(asset);
    const primary =
      variants.find((variant) => variant.name === largestWebp(variants)) ?? variants[0];
    return {
      id: asset.id,
      kind: asset.kind === "IMAGE" ? "image" : "document",
      visibility:
        asset.visibility === "PUBLIC"
          ? "public"
          : asset.visibility === "PROTECTED"
            ? "protected"
            : "private",
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      width: asset.width,
      height: asset.height,
      altText: asset.altText,
      url: primary === undefined ? "" : this.fileUrl(asset, primary.file, audience),
      variants: variants.map((variant) => ({
        name: variant.name,
        format: variant.format,
        width: variant.width,
        url: this.fileUrl(asset, variant.file, audience),
      })),
    };
  }

  private variantsOf(asset: MediaAssetRecord): MediaVariant[] {
    return mediaVariantsSchema.parse(asset.variants);
  }

  private pathOf(asset: MediaAssetRecord, file: string, audience: MediaAudience): string {
    if (asset.visibility === "PUBLIC")
      return `${mediaPublicPath}/${stripVisibility(asset.key)}/${file}`;
    if (asset.visibility === "PROTECTED") {
      return `${mediaProtectedPath}/${stripVisibility(asset.key)}/${file}`;
    }
    const prefix = audience === "admin" ? "/api/admin/media" : "/api/media";
    return `${prefix}/${asset.id}/${file}`;
  }
}

const stripVisibility = (key: string): string => key.slice(key.indexOf("/") + 1);

const largestWebp = (variants: MediaVariant[]): string | undefined => {
  const webp = variants.filter((variant) => variant.format !== "avif");
  const sorted = [...webp].sort((left, right) => (right.width ?? 0) - (left.width ?? 0));
  return sorted[0]?.name;
};
