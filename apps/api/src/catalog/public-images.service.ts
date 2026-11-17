import { Inject, Injectable } from "@nestjs/common";
import type { LessonBodyImage } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { MediaUrlService } from "../media";

const imageSelect = {
  id: true,
  key: true,
  kind: true,
  visibility: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  altText: true,
  variants: true,
} as const;

@Injectable()
export class PublicImagesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly media: MediaUrlService,
  ) {}

  async resolve(assetIds: ReadonlyArray<string | null>): Promise<Map<string, LessonBodyImage>> {
    const ids = [...new Set(assetIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const assets = await this.database.mediaAsset.findMany({
      where: { id: { in: ids }, deletedAt: null, kind: "IMAGE", visibility: "PUBLIC" },
      select: imageSelect,
    });
    return new Map(
      assets.map((asset) => [
        asset.id,
        {
          assetId: asset.id,
          url: this.media.describe(asset, "student").url,
          alt: asset.altText ?? "",
        },
      ]),
    );
  }
}
