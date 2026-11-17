import { Inject, Injectable } from "@nestjs/common";
import {
  parseRichText,
  richTextImageIds,
  richTextTextChanges,
  sameRichTextStructure,
} from "@heat/contracts";
import type {
  LessonBodyRequest,
  LessonBodyResponse,
  LessonSectionRequest,
  ModuleSummary,
  ReorderRequest,
  RichTextDoc,
} from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { MediaUrlService } from "../media";
import { applyOrderPlan, lockScope, readScope } from "./content-access";
import type { ContentLocker } from "./content-access";
import { moduleSelect, toModuleSummary } from "./modules.service";
import { assertContentUnlocked, nextOrder, planReorder, planResequence } from "./module-rules";

type SectionClient = Pick<HeatClient, "module" | "lessonSection">;

type BodyClient = SectionClient & Pick<HeatClient, "mediaAsset">;

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
  linkedEntity: true,
  linkedId: true,
} as const;

const asJson = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

const invalidBody = (): ApiException =>
  new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
    { path: "body", code: "invalid" },
  ]);

const emptyBody = { type: "doc", content: [] };

@Injectable()
export class LessonSectionsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    private readonly media: MediaUrlService,
  ) {}

  async readBody(
    courseId: string,
    moduleId: string,
    sectionId: string,
  ): Promise<LessonBodyResponse> {
    const scope = await readScope(this.database, courseId);
    await this.assertModule(this.database, scope.revisionId, moduleId);
    return this.bodyResponse(this.database, moduleId, sectionId);
  }

  async updateBody(
    courseId: string,
    moduleId: string,
    sectionId: string,
    request: LessonBodyRequest,
  ): Promise<LessonBodyResponse> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    const row = await client.lessonSection.findFirst({
      where: { id: sectionId, moduleId, deletedAt: null },
      select: { body: true },
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    const parsed = parseRichText(request.body);
    if (!parsed.ok) throw invalidBody();
    const before = parseRichText(row.body);
    const previous: RichTextDoc = before.ok ? before.doc : { type: "doc", content: [] };
    if (scope.lockedAt !== null && !sameRichTextStructure(previous, parsed.doc)) {
      throw new ApiException(409, "CONTENT_LOCKED");
    }
    await this.linkImages(client, sectionId, richTextImageIds(parsed.doc));
    await client.lessonSection.update({
      where: { id: sectionId },
      data: { body: asJson(parsed.doc), schemaVersion: request.schemaVersion },
    });
    this.audit.capture({
      entityId: sectionId,
      before: { moduleId, locked: scope.lockedAt !== null },
      after: { moduleId, changes: richTextTextChanges(previous, parsed.doc) },
    });
    return this.bodyResponse(client, moduleId, sectionId);
  }

  async create(
    courseId: string,
    moduleId: string,
    request: LessonSectionRequest,
  ): Promise<ModuleSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const highest = await client.lessonSection.aggregate({
      where: { moduleId, deletedAt: null },
      _max: { order: true },
    });
    const created = await client.lessonSection.create({
      data: {
        moduleId,
        order: nextOrder(highest._max.order),
        title: request.title,
        body: emptyBody,
        schemaVersion: 1,
      },
      select: { id: true, order: true, title: true },
    });
    this.audit.capture({ entityId: created.id, after: { moduleId, ...created } });
    return this.moduleOf(client, scope.revisionId, moduleId);
  }

  async update(
    courseId: string,
    moduleId: string,
    sectionId: string,
    request: LessonSectionRequest,
  ): Promise<ModuleSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    const before = await this.existing(client, moduleId, sectionId);
    const updated = await client.lessonSection.update({
      where: { id: sectionId },
      data: { title: request.title },
      select: { id: true, order: true, title: true },
    });
    this.audit.capture({
      entityId: sectionId,
      before: { moduleId, ...before },
      after: { moduleId, ...updated },
    });
    return this.moduleOf(client, scope.revisionId, moduleId);
  }

  async remove(courseId: string, moduleId: string, sectionId: string): Promise<ModuleSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const before = await this.existing(client, moduleId, sectionId);
    await client.lessonSection.delete({ where: { id: sectionId } });
    const remaining = await this.orderedIds(client, moduleId);
    await applyOrderPlan(planResequence(remaining), (step) =>
      client.lessonSection.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({ entityId: sectionId, before: { moduleId, ...before } });
    return this.moduleOf(client, scope.revisionId, moduleId);
  }

  async reorder(
    courseId: string,
    moduleId: string,
    request: ReorderRequest,
  ): Promise<ModuleSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const current = await this.orderedIds(client, moduleId);
    const plan = planReorder(current, request);
    await applyOrderPlan(plan, (step) =>
      client.lessonSection.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({
      entityId: moduleId,
      before: { sectionIds: current },
      after: { sectionIds: request.orderedIds },
    });
    return this.moduleOf(client, scope.revisionId, moduleId);
  }

  private async linkImages(
    client: BodyClient,
    sectionId: string,
    assetIds: string[],
  ): Promise<void> {
    const unique = [...new Set(assetIds)];
    if (unique.length === 0) return;
    const assets = await client.mediaAsset.findMany({
      where: { id: { in: unique }, deletedAt: null, kind: "IMAGE" },
      select: { id: true, linkedEntity: true, linkedId: true },
    });
    const usable = assets.filter(
      (asset) =>
        asset.linkedEntity === null ||
        (asset.linkedEntity === "LessonSection" && asset.linkedId === sectionId),
    );
    if (usable.length !== unique.length) throw invalidBody();
    await client.mediaAsset.updateMany({
      where: { id: { in: unique }, linkedEntity: null },
      data: { linkedEntity: "LessonSection", linkedId: sectionId },
    });
  }

  private async bodyResponse(
    client: BodyClient,
    moduleId: string,
    sectionId: string,
  ): Promise<LessonBodyResponse> {
    const row = await client.lessonSection.findFirst({
      where: { id: sectionId, moduleId, deletedAt: null },
      select: { id: true, title: true, schemaVersion: true, body: true },
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    const parsed = parseRichText(row.body);
    const doc: RichTextDoc = parsed.ok ? parsed.doc : { type: "doc", content: [] };
    const ids = [...new Set(richTextImageIds(doc))];
    const assets =
      ids.length === 0
        ? []
        : await client.mediaAsset.findMany({
            where: { id: { in: ids }, deletedAt: null },
            select: imageSelect,
          });
    return {
      id: row.id,
      title: row.title,
      schemaVersion: row.schemaVersion,
      body: { ...doc },
      images: assets.map((asset) => {
        const described = this.media.describe(asset, "admin");
        return { assetId: asset.id, url: described.url, alt: asset.altText ?? "" };
      }),
    };
  }

  private async moduleOf(
    client: SectionClient,
    revisionId: string,
    moduleId: string,
  ): Promise<ModuleSummary> {
    const row = await client.module.findFirst({
      where: { id: moduleId, revisionId, deletedAt: null },
      select: moduleSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return toModuleSummary(row);
  }

  private async assertModule(
    client: SectionClient,
    revisionId: string,
    moduleId: string,
  ): Promise<void> {
    await this.moduleOf(client, revisionId, moduleId);
  }

  private async existing(client: SectionClient, moduleId: string, sectionId: string) {
    const row = await client.lessonSection.findFirst({
      where: { id: sectionId, moduleId, deletedAt: null },
      select: { id: true, order: true, title: true },
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async orderedIds(client: SectionClient, moduleId: string): Promise<string[]> {
    const rows = await client.lessonSection.findMany({
      where: { moduleId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
