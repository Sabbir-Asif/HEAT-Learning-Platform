import { Inject, Injectable } from "@nestjs/common";
import { videoUploadLimits, videoUploadedEventType } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import type { Readable } from "node:stream";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { APP_CONFIG, CLOCK, DATABASE } from "../core";
import type { AppConfig, Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { lockScope, readScope } from "./content-access";
import type { ContentLocker, ContentScope } from "./content-access";
import { assertContentUnlocked } from "./module-rules";
import {
  assertContentType,
  assertOffsetMatches,
  assertTusVersion,
  isUploadExpired,
  isVideoSignature,
  newAssetKey,
  parseUploadLength,
  parseUploadOffset,
} from "./video-upload-rules";
import type { RandomBytes } from "./video-upload-rules";
import { UPLOAD_STORE } from "./video-upload-store";
import type { UploadState, UploadStore } from "./video-upload-store";

export const UPLOAD_RANDOM = Symbol("UPLOAD_RANDOM");

export interface UploadPosition {
  offset: number;
  length: number;
}

export interface UploadSlot {
  courseId: string;
  moduleId: string;
  videoId: string;
}

export interface AppendRequest {
  version: string | undefined;
  contentType: string | undefined;
  offset: string | undefined;
  body: Readable;
}

interface LocatedUpload {
  scope: ContentScope;
  asset: { id: string; status: string };
  state: UploadState;
}

@Injectable()
export class VideoUploadService {
  private readonly active = new Set<string>();

  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UPLOAD_STORE) private readonly store: UploadStore,
    @Inject(UPLOAD_RANDOM) private readonly random: RandomBytes,
  ) {}

  async start(
    slot: UploadSlot,
    headers: { version: string | undefined; length: string | undefined },
  ): Promise<{ assetKey: string; length: number }> {
    assertTusVersion(headers.version);
    const length = parseUploadLength(headers.length, videoUploadLimits.maxBytes);
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, slot.courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, slot.moduleId);
    const current = await client.video.findFirst({
      where: { id: slot.videoId, moduleId: slot.moduleId, deletedAt: null },
      select: { assetId: true },
    });
    if (current === null) throw new ApiException(404, "NOT_FOUND");
    const assetKey = newAssetKey(this.random);
    const asset = await client.videoAsset.create({
      data: { assetKey, status: "UPLOADING", referenceCount: 1 },
      select: { id: true },
    });
    await client.video.update({ where: { id: slot.videoId }, data: { assetId: asset.id } });
    if (current.assetId !== null) {
      await client.videoAsset.updateMany({
        where: { id: current.assetId, referenceCount: { gt: 0 } },
        data: { referenceCount: { decrement: 1 } },
      });
    }
    await this.store.create(assetKey, length, this.clock.now());
    this.audit.capture({
      entityId: asset.id,
      after: { videoId: slot.videoId, moduleId: slot.moduleId, assetId: asset.id, length },
    });
    return { assetKey, length };
  }

  async position(
    slot: UploadSlot,
    assetKey: string,
    version: string | undefined,
    actor: AuditActor,
  ): Promise<UploadPosition> {
    assertTusVersion(version);
    const { asset, state } = await this.locate(slot, assetKey);
    this.assertOpen(asset.status, state);
    if (state.complete && asset.status === "UPLOADING") {
      await this.finish(assetKey, asset.id, slot, actor, false);
    }
    return { offset: state.offset, length: state.length };
  }

  async append(
    slot: UploadSlot,
    assetKey: string,
    request: AppendRequest,
    actor: AuditActor,
  ): Promise<UploadPosition> {
    assertTusVersion(request.version);
    assertContentType(request.contentType);
    const clientOffset = parseUploadOffset(request.offset);
    const { scope, asset, state } = await this.locate(slot, assetKey);
    assertContentUnlocked(scope.lockedAt);
    this.assertOpen(asset.status, state);
    assertOffsetMatches(state.offset, clientOffset);
    if (asset.status !== "UPLOADING") throw new ApiException(409, "UPLOAD_OFFSET_MISMATCH");
    if (this.active.has(assetKey)) throw new ApiException(409, "UPLOAD_OFFSET_MISMATCH");
    this.active.add(assetKey);
    try {
      if (state.complete) {
        await this.finish(assetKey, asset.id, slot, actor, false);
        return { offset: state.length, length: state.length };
      }
      const offset = await this.store.append(assetKey, request.body, state.length - state.offset);
      await this.checkSignature(assetKey, asset.id, state.offset, offset);
      if (offset === state.length) await this.finish(assetKey, asset.id, slot, actor, true);
      return { offset, length: state.length };
    } finally {
      this.active.delete(assetKey);
    }
  }

  private async locate(slot: UploadSlot, assetKey: string): Promise<LocatedUpload> {
    const scope = await readScope(this.database, slot.courseId);
    await this.assertModule(this.database, scope.revisionId, slot.moduleId);
    const row = await this.database.video.findFirst({
      where: {
        id: slot.videoId,
        moduleId: slot.moduleId,
        deletedAt: null,
        asset: { assetKey },
      },
      select: { asset: { select: { id: true, status: true } } },
    });
    const asset = row?.asset ?? null;
    const state = asset === null ? null : await this.store.state(assetKey);
    if (asset === null || state === null) throw new ApiException(404, "NOT_FOUND");
    return { scope, asset, state };
  }

  private assertOpen(status: string, state: UploadState): void {
    if (status !== "UPLOADING" && status !== "UPLOADED") throw new ApiException(404, "NOT_FOUND");
    if (
      !state.complete &&
      isUploadExpired(state.createdAt, this.clock.now(), this.config.videoUploads.expiryHours)
    ) {
      throw new ApiException(410, "UPLOAD_EXPIRED");
    }
  }

  private async checkSignature(
    assetKey: string,
    assetId: string,
    before: number,
    after: number,
  ): Promise<void> {
    const size = videoUploadLimits.minBytes;
    if (before >= size || after < size) return;
    if (isVideoSignature(await this.store.head(assetKey, size))) return;
    await this.store.discard(assetKey);
    await this.database.videoAsset.updateMany({
      where: { id: assetId, status: "UPLOADING" },
      data: { status: "REJECTED", rejectionReason: "NOT_A_VIDEO" },
    });
    throw new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED");
  }

  private async finish(
    assetKey: string,
    assetId: string,
    slot: UploadSlot,
    actor: AuditActor,
    needsStore: boolean,
  ): Promise<void> {
    if (needsStore) await this.store.complete(assetKey);
    await this.database.$transaction(async (tx) => {
      const flipped = await tx.videoAsset.updateMany({
        where: { id: assetId, status: "UPLOADING" },
        data: { status: "UPLOADED" },
      });
      if (flipped.count === 0) return;
      await tx.outbox.create({
        data: { eventType: videoUploadedEventType, payload: { assetId } },
      });
      await this.audit.record(tx, actor, {
        action: "video-upload.complete",
        entity: "VideoAsset",
        entityId: assetId,
        after: { videoId: slot.videoId, moduleId: slot.moduleId, assetId },
      });
    });
  }

  private async assertModule(
    client: Pick<HeatClient, "module">,
    revisionId: string,
    moduleId: string,
  ): Promise<void> {
    const row = await client.module.findFirst({
      where: { id: moduleId, revisionId, deletedAt: null },
      select: { id: true },
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
  }
}
