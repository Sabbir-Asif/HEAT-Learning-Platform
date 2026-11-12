import { Inject, Injectable } from "@nestjs/common";
import type { SetTagsRequest, TagRef, TagRefListResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { readScope } from "./content-access";
import { frontPageCacheTag, PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";
import { denseOrder, nextDisplayOrder, planTagSet } from "./tag-rules";

interface LinkStore {
  currentTagIds(): Promise<string[]>;
  highestOrder(tagId: string): Promise<number | null>;
  add(tagId: string, displayOrder: number): Promise<void>;
  remove(tagId: string): Promise<void>;
  remainingIds(tagId: string): Promise<string[]>;
  setOrder(tagId: string, id: string, displayOrder: number): Promise<void>;
}

const tagRefSelect = { id: true, slug: true, name: true, isSystem: true };

const byName = (left: TagRef, right: TagRef): number => left.name.localeCompare(right.name);

@Injectable()
export class TagAssignmentsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async courseTags(courseId: string): Promise<TagRefListResponse> {
    await readScope(this.database, courseId);
    return this.readCourse(this.database, courseId);
  }

  async moduleTags(courseId: string, moduleId: string): Promise<TagRefListResponse> {
    const scope = await readScope(this.database, courseId);
    await this.assertModule(this.database, scope.revisionId, moduleId);
    return this.readModule(this.database, moduleId);
  }

  async setCourseTags(courseId: string, request: SetTagsRequest): Promise<TagRefListResponse> {
    const client = this.audit.client(this.database);
    await readScope(client, courseId);
    await this.assertTagsExist(client, request.tagIds);
    const store = this.courseStore(client, courseId);
    const before = await store.currentTagIds();
    await this.apply(store, before, request.tagIds);
    this.audit.capture({
      entityId: courseId,
      before: { tagIds: before },
      after: { tagIds: request.tagIds },
    });
    this.revalidateAfterCommit();
    return this.readCourse(client, courseId);
  }

  async setModuleTags(
    courseId: string,
    moduleId: string,
    request: SetTagsRequest,
  ): Promise<TagRefListResponse> {
    const client = this.audit.client(this.database);
    const scope = await readScope(client, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    await this.assertTagsExist(client, request.tagIds);
    const store = this.moduleStore(client, moduleId);
    const before = await store.currentTagIds();
    await this.apply(store, before, request.tagIds);
    this.audit.capture({
      entityId: moduleId,
      before: { tagIds: before },
      after: { tagIds: request.tagIds },
    });
    this.revalidateAfterCommit();
    return this.readModule(client, moduleId);
  }

  private async apply(store: LinkStore, before: string[], requested: string[]): Promise<void> {
    const plan = planTagSet(before, requested);
    for (const tagId of plan.remove) {
      await store.remove(tagId);
      for (const step of denseOrder(await store.remainingIds(tagId))) {
        await store.setOrder(tagId, step.id, step.order);
      }
    }
    for (const tagId of plan.add) {
      await store.add(tagId, nextDisplayOrder(await store.highestOrder(tagId)));
    }
  }

  private courseStore(client: Pick<HeatClient, "courseTag">, courseId: string): LinkStore {
    return {
      currentTagIds: async () =>
        (
          await client.courseTag.findMany({
            where: { courseId, tag: { deletedAt: null } },
            select: { tagId: true },
          })
        ).map((link) => link.tagId),
      highestOrder: async (tagId) =>
        (await client.courseTag.aggregate({ where: { tagId }, _max: { displayOrder: true } }))._max
          .displayOrder,
      add: async (tagId, displayOrder) => {
        await client.courseTag.create({ data: { courseId, tagId, displayOrder } });
      },
      remove: async (tagId) => {
        await client.courseTag.deleteMany({ where: { courseId, tagId } });
      },
      remainingIds: async (tagId) =>
        (
          await client.courseTag.findMany({
            where: { tagId },
            orderBy: { displayOrder: "asc" },
            select: { courseId: true },
          })
        ).map((link) => link.courseId),
      setOrder: async (tagId, id, displayOrder) => {
        await client.courseTag.update({
          where: { courseId_tagId: { courseId: id, tagId } },
          data: { displayOrder },
        });
      },
    };
  }

  private moduleStore(client: Pick<HeatClient, "moduleTag">, moduleId: string): LinkStore {
    return {
      currentTagIds: async () =>
        (
          await client.moduleTag.findMany({
            where: { moduleId, tag: { deletedAt: null } },
            select: { tagId: true },
          })
        ).map((link) => link.tagId),
      highestOrder: async (tagId) =>
        (await client.moduleTag.aggregate({ where: { tagId }, _max: { displayOrder: true } }))._max
          .displayOrder,
      add: async (tagId, displayOrder) => {
        await client.moduleTag.create({ data: { moduleId, tagId, displayOrder } });
      },
      remove: async (tagId) => {
        await client.moduleTag.deleteMany({ where: { moduleId, tagId } });
      },
      remainingIds: async (tagId) =>
        (
          await client.moduleTag.findMany({
            where: { tagId },
            orderBy: { displayOrder: "asc" },
            select: { moduleId: true },
          })
        ).map((link) => link.moduleId),
      setOrder: async (tagId, id, displayOrder) => {
        await client.moduleTag.update({
          where: { moduleId_tagId: { moduleId: id, tagId } },
          data: { displayOrder },
        });
      },
    };
  }

  private async readCourse(
    client: Pick<HeatClient, "courseTag">,
    courseId: string,
  ): Promise<TagRefListResponse> {
    const links = await client.courseTag.findMany({
      where: { courseId, tag: { deletedAt: null } },
      select: { tag: { select: tagRefSelect } },
    });
    return { items: links.map((link) => link.tag).sort(byName) };
  }

  private async readModule(
    client: Pick<HeatClient, "moduleTag">,
    moduleId: string,
  ): Promise<TagRefListResponse> {
    const links = await client.moduleTag.findMany({
      where: { moduleId, tag: { deletedAt: null } },
      select: { tag: { select: tagRefSelect } },
    });
    return { items: links.map((link) => link.tag).sort(byName) };
  }

  private async assertModule(
    client: Pick<HeatClient, "module">,
    revisionId: string,
    moduleId: string,
  ): Promise<void> {
    const found = await client.module.findFirst({
      where: { id: moduleId, revisionId, deletedAt: null },
      select: { id: true },
    });
    if (found === null) throw new ApiException(404, "NOT_FOUND");
  }

  private async assertTagsExist(client: Pick<HeatClient, "tag">, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    const found = await client.tag.count({ where: { id: { in: tagIds } } });
    if (found !== tagIds.length) {
      throw new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
        { path: "tagIds", code: "invalid" },
      ]);
    }
  }

  private revalidateAfterCommit(): void {
    this.audit.afterCommit(() => this.revalidation.revalidate([frontPageCacheTag]));
  }
}
