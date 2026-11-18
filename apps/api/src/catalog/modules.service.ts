import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateModuleRequest,
  ModuleListResponse,
  ModuleSummary,
  ReorderRequest,
  UpdateModuleRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { applyOrderPlan, lockScope, readScope } from "./content-access";
import type { ContentLocker } from "./content-access";
import { courseCacheTag, frontPageCacheTag, PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";
import {
  assertContentUnlocked,
  assertObjectivesWording,
  nextOrder,
  planReorder,
  planResequence,
} from "./module-rules";
import { highestModuleOrder } from "./highest-order";

export const moduleSelect = {
  id: true,
  order: true,
  title: true,
  objectives: true,
  createdAt: true,
  updatedAt: true,
  lessonSections: {
    where: { deletedAt: null },
    orderBy: { order: "asc" as const },
    select: { id: true, order: true, title: true },
  },
};

export interface ModuleRow {
  id: string;
  order: number;
  title: string;
  objectives: string[];
  createdAt: Date;
  updatedAt: Date;
  lessonSections: Array<{ id: string; order: number; title: string }>;
}

export const toModuleSummary = (row: ModuleRow): ModuleSummary => ({
  id: row.id,
  order: row.order,
  title: row.title,
  objectives: row.objectives,
  sections: row.lessonSections.map((section) => ({
    id: section.id,
    order: section.order,
    title: section.title,
  })),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const auditedFields = (row: ModuleRow) => ({
  order: row.order,
  title: row.title,
  objectives: row.objectives,
});

@Injectable()
export class ModulesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async list(courseId: string): Promise<ModuleListResponse> {
    const scope = await readScope(this.database, courseId);
    const rows = await this.database.module.findMany({
      where: { revisionId: scope.revisionId, deletedAt: null },
      orderBy: { order: "asc" },
      select: moduleSelect,
    });
    return { items: rows.map(toModuleSummary), locked: scope.lockedAt !== null };
  }

  async get(courseId: string, moduleId: string): Promise<ModuleSummary> {
    const scope = await readScope(this.database, courseId);
    return toModuleSummary(await this.existing(this.database, scope.revisionId, moduleId));
  }

  async create(courseId: string, request: CreateModuleRequest): Promise<ModuleSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    const highest = await highestModuleOrder(client, scope.revisionId);
    const created = await client.module.create({
      data: {
        revisionId: scope.revisionId,
        order: nextOrder(highest),
        title: request.title,
        objectives: request.objectives,
      },
      select: moduleSelect,
    });
    this.audit.capture({ entityId: created.id, after: auditedFields(created) });
    this.revalidateAfterCommit(courseId);
    return toModuleSummary(created);
  }

  async update(
    courseId: string,
    moduleId: string,
    request: UpdateModuleRequest,
  ): Promise<ModuleSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    const before = await this.existing(client, scope.revisionId, moduleId);
    assertObjectivesWording(scope.lockedAt, before.objectives, request.objectives);
    const updated = await client.module.update({
      where: { id: moduleId },
      data: { title: request.title, objectives: request.objectives },
      select: moduleSelect,
    });
    this.audit.capture({
      entityId: moduleId,
      before: auditedFields(before),
      after: auditedFields(updated),
    });
    this.revalidateAfterCommit(courseId);
    return toModuleSummary(updated);
  }

  async remove(courseId: string, moduleId: string): Promise<void> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    const before = await this.existing(client, scope.revisionId, moduleId);
    const quiz = await client.quiz.findUnique({ where: { moduleId }, select: { id: true } });
    if (quiz !== null) {
      await client.option.deleteMany({ where: { question: { quizId: quiz.id } } });
      await client.question.deleteMany({ where: { quizId: quiz.id } });
      await client.quiz.delete({ where: { id: quiz.id } });
    }
    const slots = await client.video.findMany({
      where: { moduleId, assetId: { not: null } },
      select: { assetId: true },
    });
    for (const slot of slots) {
      await client.videoAsset.updateMany({
        where: { id: slot.assetId ?? "", referenceCount: { gt: 0 } },
        data: { referenceCount: { decrement: 1 } },
      });
    }
    await client.video.deleteMany({ where: { moduleId } });
    await client.moduleTag.deleteMany({ where: { moduleId } });
    await client.lessonSection.deleteMany({ where: { moduleId } });
    await client.module.delete({ where: { id: moduleId } });
    const remaining = await this.orderedIds(client, scope.revisionId);
    await applyOrderPlan(planResequence(remaining), (step) =>
      client.module.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({ entityId: moduleId, before: auditedFields(before) });
    this.revalidateAfterCommit(courseId);
  }

  async reorder(courseId: string, request: ReorderRequest): Promise<ModuleListResponse> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    const current = await this.orderedIds(client, scope.revisionId);
    const plan = planReorder(current, request);
    await applyOrderPlan(plan, (step) =>
      client.module.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({
      entityId: scope.revisionId,
      before: { moduleIds: current },
      after: { moduleIds: request.orderedIds },
    });
    this.revalidateAfterCommit(courseId);
    const rows = await client.module.findMany({
      where: { revisionId: scope.revisionId, deletedAt: null },
      orderBy: { order: "asc" },
      select: moduleSelect,
    });
    return { items: rows.map(toModuleSummary), locked: false };
  }

  private revalidateAfterCommit(courseId: string): void {
    this.audit.afterCommit(async () => {
      const course = await this.database.course.findUnique({
        where: { id: courseId },
        select: { slug: true },
      });
      const tags = course === null ? [] : [frontPageCacheTag, courseCacheTag(course.slug)];
      await this.revalidation.revalidate(tags);
    });
  }

  private async existing(
    client: Pick<HeatClient, "module">,
    revisionId: string,
    moduleId: string,
  ): Promise<ModuleRow> {
    const row = await client.module.findFirst({
      where: { id: moduleId, revisionId, deletedAt: null },
      select: moduleSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async orderedIds(client: Pick<HeatClient, "module">, revisionId: string) {
    const rows = await client.module.findMany({
      where: { revisionId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
