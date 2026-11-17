import { Inject, Injectable } from "@nestjs/common";
import type { CaptionLanguage } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { assertCaptionFile } from "../media/media-rules";
import { readScope } from "./content-access";
import { CAPTION_STORE } from "./video-caption-store";
import type { CaptionStore } from "./video-caption-store";

export interface CaptionTarget {
  courseId: string;
  moduleId: string;
  videoId: string;
  language: CaptionLanguage;
}

interface CaptionedAsset {
  id: string;
  assetKey: string;
}

@Injectable()
export class VideoCaptionsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CAPTION_STORE) private readonly store: CaptionStore,
    private readonly audit: AuditService,
  ) {}

  async put(target: CaptionTarget, bytes: Buffer): Promise<void> {
    assertCaptionFile(bytes);
    const client = this.audit.client(this.database);
    const asset = await this.readyAsset(client, target);
    await this.store.write(asset.assetKey, target.language, bytes);
    const existing = await client.videoCaption.findUnique({
      where: { assetId_language: { assetId: asset.id, language: target.language } },
      select: { id: true },
    });
    if (existing === null) {
      const created = await client.videoCaption.create({
        data: {
          assetId: asset.id,
          language: target.language,
          captionKey: `${asset.assetKey}/${target.language}`,
        },
        select: { id: true },
      });
      this.audit.capture({
        entityId: created.id,
        after: { assetId: asset.id, language: target.language, sizeBytes: bytes.length },
      });
      return;
    }
    await client.videoCaption.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
    this.audit.capture({
      entityId: existing.id,
      before: { assetId: asset.id, language: target.language },
      after: { assetId: asset.id, language: target.language, sizeBytes: bytes.length },
    });
  }

  async remove(target: CaptionTarget): Promise<void> {
    const client = this.audit.client(this.database);
    const asset = await this.readyAsset(client, target);
    const existing = await client.videoCaption.findUnique({
      where: { assetId_language: { assetId: asset.id, language: target.language } },
      select: { id: true },
    });
    if (existing === null) throw new ApiException(404, "NOT_FOUND");
    await client.videoCaption.delete({ where: { id: existing.id } });
    await this.store.remove(asset.assetKey, target.language);
    this.audit.capture({
      entityId: existing.id,
      before: { assetId: asset.id, language: target.language },
    });
  }

  private async readyAsset(
    client: Pick<HeatClient, "course" | "module" | "video">,
    target: CaptionTarget,
  ): Promise<CaptionedAsset> {
    const scope = await readScope(client, target.courseId);
    const video = await client.video.findFirst({
      where: {
        id: target.videoId,
        moduleId: target.moduleId,
        deletedAt: null,
        module: { id: target.moduleId, revisionId: scope.revisionId, deletedAt: null },
      },
      select: { asset: { select: { id: true, assetKey: true, status: true } } },
    });
    if (video === null) throw new ApiException(404, "NOT_FOUND");
    if (video.asset === null || video.asset.status !== "READY") {
      throw new ApiException(409, "VIDEO_NOT_READY");
    }
    return { id: video.asset.id, assetKey: video.asset.assetKey };
  }
}
