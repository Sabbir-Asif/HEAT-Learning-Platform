import { Inject, Injectable } from "@nestjs/common";
import {
  captionLanguageSchema,
  videoFailureReasonSchema,
  videoQueuedEventType,
  videoRejectionReasonSchema,
} from "@heat/contracts";
import type {
  CreateVideoSlotRequest,
  VideoFailureReason,
  VideoRejectionReason,
  ReorderRequest,
  UpdateVideoSlotRequest,
  VideoSlotListResponse,
  VideoSlotStatus,
  VideoSlotSummary,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { applyOrderPlan, lockScope, readScope } from "./content-access";
import type { ContentLocker } from "./content-access";
import { assertContentUnlocked, nextOrder, planReorder, planResequence } from "./module-rules";
import { highestVideoOrder } from "./highest-order";
import { assertRequiredFlagUnlocked, slotStatusOf } from "./video-rules";

type SlotClient = Pick<HeatClient, "module" | "video">;

const slotSelect = {
  id: true,
  order: true,
  title: true,
  required: true,
  assetId: true,
  asset: {
    select: {
      status: true,
      assetKey: true,
      rejectionReason: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
      captions: { select: { language: true }, orderBy: { language: "asc" as const } },
    },
  },
};

interface SlotRow {
  id: string;
  order: number;
  title: string;
  required: boolean;
  assetId: string | null;
  asset: {
    status: VideoSlotStatus;
    assetKey: string;
    rejectionReason: string | null;
    failureReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    captions: Array<{ language: string }>;
  } | null;
}

const reasonOf = (value: string | null): VideoRejectionReason | null => {
  const parsed = videoRejectionReasonSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const failureOf = (value: string | null): VideoFailureReason | null => {
  const parsed = videoFailureReasonSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const toSlotSummary = (row: SlotRow): VideoSlotSummary => ({
  id: row.id,
  order: row.order,
  title: row.title,
  required: row.required,
  status: slotStatusOf(row.asset),
  assetKey: row.asset?.assetKey ?? null,
  rejectionReason: reasonOf(row.asset?.rejectionReason ?? null),
  failureReason: failureOf(row.asset?.failureReason ?? null),
  uploadedAt: row.asset?.createdAt.toISOString() ?? null,
  statusChangedAt: row.asset?.updatedAt.toISOString() ?? null,
  captions: (row.asset?.captions ?? []).flatMap((caption) => {
    const parsed = captionLanguageSchema.safeParse(caption.language);
    return parsed.success ? [parsed.data] : [];
  }),
});

const auditedFields = (moduleId: string, row: SlotRow) => ({
  moduleId,
  order: row.order,
  title: row.title,
  required: row.required,
  assetId: row.assetId,
});

@Injectable()
export class VideoSlotsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

  async list(courseId: string, moduleId: string): Promise<VideoSlotListResponse> {
    const scope = await readScope(this.database, courseId);
    await this.assertModule(this.database, scope.revisionId, moduleId);
    return this.listOf(this.database, moduleId, scope.lockedAt !== null);
  }

  async retryTranscode(
    courseId: string,
    moduleId: string,
    videoId: string,
  ): Promise<VideoSlotListResponse> {
    const client = this.audit.client(this.database);
    const scope = await readScope(client, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    const slot = await this.existing(client, moduleId, videoId);
    if (slot.assetId === null) throw new ApiException(409, "VIDEO_NOT_FAILED");
    const flipped = await client.videoAsset.updateMany({
      where: { id: slot.assetId, status: "FAILED" },
      data: { status: "QUEUED", failureReason: null },
    });
    if (flipped.count === 0) throw new ApiException(409, "VIDEO_NOT_FAILED");
    await client.outbox.create({
      data: { eventType: videoQueuedEventType, payload: { assetId: slot.assetId } },
    });
    this.audit.capture({
      entityId: slot.assetId,
      before: { status: "FAILED", failureReason: slot.asset?.failureReason ?? null },
      after: { status: "QUEUED", videoId, moduleId },
    });
    return this.listOf(client, moduleId, scope.lockedAt !== null);
  }

  async create(
    courseId: string,
    moduleId: string,
    request: CreateVideoSlotRequest,
  ): Promise<VideoSlotListResponse> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const highest = await highestVideoOrder(client, moduleId);
    const created = await client.video.create({
      data: {
        moduleId,
        order: nextOrder(highest),
        title: request.title,
        required: request.required,
      },
      select: slotSelect,
    });
    this.audit.capture({ entityId: created.id, after: auditedFields(moduleId, created) });
    return this.listOf(client, moduleId, false);
  }

  async update(
    courseId: string,
    moduleId: string,
    videoId: string,
    request: UpdateVideoSlotRequest,
  ): Promise<VideoSlotListResponse> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    const before = await this.existing(client, moduleId, videoId);
    assertRequiredFlagUnlocked(scope.lockedAt, before.required, request.required);
    const updated = await client.video.update({
      where: { id: videoId },
      data: { title: request.title, required: request.required },
      select: slotSelect,
    });
    this.audit.capture({
      entityId: videoId,
      before: auditedFields(moduleId, before),
      after: auditedFields(moduleId, updated),
    });
    return this.listOf(client, moduleId, scope.lockedAt !== null);
  }

  async remove(
    courseId: string,
    moduleId: string,
    videoId: string,
  ): Promise<VideoSlotListResponse> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const before = await this.existing(client, moduleId, videoId);
    await client.video.delete({ where: { id: videoId } });
    if (before.assetId !== null) {
      await client.videoAsset.updateMany({
        where: { id: before.assetId, referenceCount: { gt: 0 } },
        data: { referenceCount: { decrement: 1 } },
      });
    }
    const remaining = await this.orderedIds(client, moduleId);
    await applyOrderPlan(planResequence(remaining), (step) =>
      client.video.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({ entityId: videoId, before: auditedFields(moduleId, before) });
    return this.listOf(client, moduleId, false);
  }

  async reorder(
    courseId: string,
    moduleId: string,
    request: ReorderRequest,
  ): Promise<VideoSlotListResponse> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const current = await this.orderedIds(client, moduleId);
    const plan = planReorder(current, request);
    await applyOrderPlan(plan, (step) =>
      client.video.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({
      entityId: moduleId,
      before: { videoIds: current },
      after: { videoIds: request.orderedIds },
    });
    return this.listOf(client, moduleId, false);
  }

  private async listOf(
    client: Pick<HeatClient, "video">,
    moduleId: string,
    locked: boolean,
  ): Promise<VideoSlotListResponse> {
    const rows = await client.video.findMany({
      where: { moduleId, deletedAt: null },
      orderBy: { order: "asc" },
      select: slotSelect,
    });
    return { items: rows.map(toSlotSummary), locked };
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

  private async existing(client: SlotClient, moduleId: string, videoId: string): Promise<SlotRow> {
    const row = await client.video.findFirst({
      where: { id: videoId, moduleId, deletedAt: null },
      select: slotSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async orderedIds(client: SlotClient, moduleId: string): Promise<string[]> {
    const rows = await client.video.findMany({
      where: { moduleId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
