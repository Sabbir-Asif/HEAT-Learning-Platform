import { Inject, Injectable } from "@nestjs/common";
import { resourcePublicLimit } from "@heat/contracts";
import type { ResourcePublic, ResourcePublicListResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { MediaUrlService } from "../media";
import { publicWhere } from "./resource-rules";

@Injectable()
export class PublicResourcesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly urls: MediaUrlService,
  ) {}

  async list(): Promise<ResourcePublicListResponse> {
    const rows = await this.database.resource.findMany({
      where: publicWhere,
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      take: resourcePublicLimit,
      select: {
        id: true,
        kind: true,
        title: true,
        description: true,
        url: true,
        mediaAsset: {
          select: {
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
          },
        },
      },
    });
    return {
      items: rows.flatMap((row): ResourcePublic[] => {
        const base = { id: row.id, title: row.title, description: row.description };
        if (row.kind === "LINK") {
          if (row.url === null) return [];
          return [
            { ...base, kind: "link" as const, url: row.url, mimeType: null, sizeBytes: null },
          ];
        }
        if (row.mediaAsset === null) return [];
        const asset = this.urls.describe(row.mediaAsset, "student");
        return [
          {
            ...base,
            kind: "file" as const,
            url: asset.url,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
          },
        ];
      }),
    };
  }
}
