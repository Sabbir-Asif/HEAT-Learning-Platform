import { Inject, Injectable } from "@nestjs/common";
import type { LessonSectionRequest, ModuleSummary, ReorderRequest } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { applyOrderPlan, lockScope } from "./content-access";
import type { ContentLocker } from "./content-access";
import { moduleSelect, toModuleSummary } from "./modules.service";
import { assertContentUnlocked, nextOrder, planReorder, planResequence } from "./module-rules";

type SectionClient = Pick<HeatClient, "module" | "lessonSection">;

const emptyBody = { type: "doc", content: [] };

@Injectable()
export class LessonSectionsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

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
