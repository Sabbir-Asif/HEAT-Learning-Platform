import { Inject, Injectable } from "@nestjs/common";
import { mediaVariantsSchema } from "@heat/contracts";
import type { MediaAssetResponse, MediaUploadFields, MediaVariant } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { createHash, randomUUID } from "node:crypto";
import { AuditService } from "../audit";
import { CLOCK, DATABASE, MEDIA_STORAGE } from "../core";
import type { Clock, MediaStorage } from "../core";
import { ApiException } from "../http/api-exception";
import { IMAGE_PROCESSOR } from "./image-processor";
import type { ImageProcessor } from "./image-processor";
import {
  assertAltText,
  assertTypeMatchesKind,
  assertWithinSize,
  canReadPrivate,
  documentExtension,
  mediaKey,
  mimeOfFile,
} from "./media-rules";
import { sniffMediaType } from "./media-sniff";
import type { SniffedType } from "./media-sniff";
import { MediaUrlService } from "./media-url.service";
import type { MediaAudience } from "./media-url.service";

export const MEDIA_ID = Symbol("MEDIA_ID");

export interface UploadedFile {
  buffer: Buffer;
}

export interface PrivateFileGrant {
  internalPath: string;
  mimeType: string;
}

const visibilityOf = (
  value: MediaUploadFields["visibility"],
): "PUBLIC" | "PROTECTED" | "PRIVATE" =>
  value === "public" ? "PUBLIC" : value === "protected" ? "PROTECTED" : "PRIVATE";

const originalName = "original";

@Injectable()
export class MediaService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(IMAGE_PROCESSOR) private readonly images: ImageProcessor,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MEDIA_ID) private readonly newId: () => string,
    private readonly urls: MediaUrlService,
    private readonly audit: AuditService,
  ) {}

  async upload(
    uploaderId: string,
    file: UploadedFile,
    fields: MediaUploadFields,
    audience: MediaAudience = "admin",
  ): Promise<MediaAssetResponse> {
    const type = assertTypeMatchesKind(fields.kind, sniffMediaType(file.buffer));
    assertWithinSize(fields.kind, type, file.buffer.length);
    assertAltText(fields);
    const key = mediaKey(fields.visibility, this.clock.now(), this.newId());
    const stored =
      fields.kind === "image"
        ? await this.storeImage(key, file.buffer, fields)
        : await this.storeDocument(key, file.buffer, type);
    try {
      const asset = await this.database.mediaAsset.create({
        data: {
          key,
          kind: fields.kind === "image" ? "IMAGE" : "DOCUMENT",
          visibility: visibilityOf(fields.visibility),
          mimeType: stored.mimeType,
          sizeBytes: stored.variants.reduce((total, variant) => total + variant.sizeBytes, 0),
          width: stored.width,
          height: stored.height,
          sha256: createHash("sha256").update(file.buffer).digest("hex"),
          variants: stored.variants,
          uploaderId,
          altText: fields.altText ?? null,
        },
      });
      this.audit.capture({
        entityId: asset.id,
        after: { kind: fields.kind, visibility: fields.visibility, mimeType: stored.mimeType },
      });
      return this.urls.describe(asset, audience);
    } catch (error) {
      await this.storage.removeAsset(key);
      throw error;
    }
  }

  async link(assetId: string, entity: string, entityId: string): Promise<void> {
    const result = await this.database.mediaAsset.updateMany({
      where: {
        id: assetId,
        OR: [{ linkedEntity: null }, { linkedEntity: entity, linkedId: entityId }],
      },
      data: { linkedEntity: entity, linkedId: entityId },
    });
    if (result.count === 0) throw new ApiException(404, "NOT_FOUND");
  }

  async release(assetId: string): Promise<void> {
    const asset = await this.database.mediaAsset.findUnique({
      where: { id: assetId },
      select: { id: true, key: true },
    });
    if (asset === null) return;
    await this.database.mediaAsset.delete({ where: { id: asset.id } });
    await this.storage.removeAsset(asset.key);
  }

  async privateFile(
    assetId: string,
    file: string,
    viewer: { userId: string; admin: boolean },
  ): Promise<PrivateFileGrant> {
    const asset = await this.database.mediaAsset.findUnique({ where: { id: assetId } });
    if (asset === null || asset.visibility !== "PRIVATE") throw new ApiException(404, "NOT_FOUND");
    if (!canReadPrivate(viewer, asset.uploaderId)) throw new ApiException(403, "FORBIDDEN");
    const variants = mediaVariantsSchema.parse(asset.variants);
    if (!variants.some((variant) => variant.file === file))
      throw new ApiException(404, "NOT_FOUND");
    return {
      internalPath: `/internal/media/${asset.key}/${file}`,
      mimeType: mimeOfFile(file, asset.mimeType),
    };
  }

  private async storeImage(
    key: string,
    bytes: Buffer,
    fields: MediaUploadFields,
  ): Promise<StoredMedia> {
    const processed = await this.images.process(bytes, {
      crop: fields.crop,
      avif: fields.crop !== "square",
    });
    try {
      for (const image of processed.files) await this.storage.write(key, image.file, image.bytes);
    } catch (error) {
      await this.storage.removeAsset(key);
      throw error;
    }
    return {
      mimeType: "image/webp",
      width: processed.width,
      height: processed.height,
      variants: processed.files.map((image) => ({
        name: image.name,
        file: image.file,
        format: image.format,
        width: image.width,
        height: image.height,
        sizeBytes: image.bytes.length,
      })),
    };
  }

  private async storeDocument(key: string, bytes: Buffer, type: SniffedType): Promise<StoredMedia> {
    const file = `${originalName}.${documentExtension(type)}`;
    try {
      await this.storage.write(key, file, bytes);
    } catch (error) {
      await this.storage.removeAsset(key);
      throw error;
    }
    return {
      mimeType: type,
      width: null,
      height: null,
      variants: [
        {
          name: originalName,
          file,
          format: "original",
          width: null,
          height: null,
          sizeBytes: bytes.length,
        },
      ],
    };
  }
}

interface StoredMedia {
  mimeType: string;
  width: number | null;
  height: number | null;
  variants: MediaVariant[];
}

export const randomMediaId = (): string => randomUUID();
