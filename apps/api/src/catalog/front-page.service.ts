import { Inject, Injectable } from "@nestjs/common";
import { frontpageTagSlug } from "@heat/contracts";
import type {
  AdminFrontPageResponse,
  PublicFrontPageResponse,
  ReorderRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { planReorder } from "./module-rules";
import { PublicImagesService } from "./public-images.service";
import { frontPageCacheTag, PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";

const publishedModule = {
  deletedAt: null,
  revision: { deletedAt: null, publishedAt: { not: null }, course: { deletedAt: null } },
};

const adminModuleSelect = {
  moduleId: true,
  module: {
    select: {
      id: true,
      title: true,
      revision: {
        select: {
          publishedAt: true,
          courseId: true,
          course: { select: { title: true, status: true } },
        },
      },
    },
  },
};

@Injectable()
export class FrontPageService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
    private readonly images: PublicImagesService,
  ) {}

  async admin(): Promise<AdminFrontPageResponse> {
    return this.readAdmin(this.database, await this.tagId(this.database));
  }

  async reorderCourses(request: ReorderRequest): Promise<AdminFrontPageResponse> {
    const client = this.audit.client(this.database);
    const tagId = await this.lockTag(client);
    const current = (await this.readAdmin(client, tagId)).courses.map((course) => course.id);
    const plan = planReorder(current, request);
    for (const step of plan.final) {
      await client.courseTag.update({
        where: { courseId_tagId: { courseId: step.id, tagId } },
        data: { displayOrder: step.order },
      });
    }
    this.audit.capture({
      entityId: tagId,
      before: { courseIds: current },
      after: { courseIds: request.orderedIds },
    });
    this.revalidateAfterCommit();
    return this.readAdmin(client, tagId);
  }

  async reorderModules(request: ReorderRequest): Promise<AdminFrontPageResponse> {
    const client = this.audit.client(this.database);
    const tagId = await this.lockTag(client);
    const current = (await this.readAdmin(client, tagId)).modules.map((module) => module.id);
    const plan = planReorder(current, request);
    for (const step of plan.final) {
      await client.moduleTag.update({
        where: { moduleId_tagId: { moduleId: step.id, tagId } },
        data: { displayOrder: step.order },
      });
    }
    this.audit.capture({
      entityId: tagId,
      before: { moduleIds: current },
      after: { moduleIds: request.orderedIds },
    });
    this.revalidateAfterCommit();
    return this.readAdmin(client, tagId);
  }

  async public(): Promise<PublicFrontPageResponse> {
    const tagId = await this.tagId(this.database);
    const [courses, modules] = await Promise.all([
      this.database.courseTag.findMany({
        where: { tagId, course: { deletedAt: null, status: "PUBLISHED" } },
        orderBy: { displayOrder: "asc" },
        select: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              thumbnailAssetId: true,
            },
          },
        },
      }),
      this.database.moduleTag.findMany({
        where: {
          tagId,
          module: {
            ...publishedModule,
            revision: {
              ...publishedModule.revision,
              course: { deletedAt: null, status: "PUBLISHED" },
            },
          },
        },
        orderBy: { displayOrder: "asc" },
        select: {
          module: {
            select: {
              id: true,
              title: true,
              revision: { select: { course: { select: { slug: true, title: true } } } },
            },
          },
        },
      }),
    ]);
    const images = await this.images.resolve(courses.map((link) => link.course.thumbnailAssetId));
    return {
      courses: courses.map((link) => ({
        ...link.course,
        thumbnail:
          link.course.thumbnailAssetId === null
            ? null
            : (images.get(link.course.thumbnailAssetId) ?? null),
      })),
      modules: modules.map((link) => ({
        id: link.module.id,
        title: link.module.title,
        courseSlug: link.module.revision.course.slug,
        courseTitle: link.module.revision.course.title,
      })),
    };
  }

  private async readAdmin(
    client: Pick<HeatClient, "courseTag" | "moduleTag">,
    tagId: string,
  ): Promise<AdminFrontPageResponse> {
    const [courses, modules] = await Promise.all([
      client.courseTag.findMany({
        where: { tagId, course: { deletedAt: null } },
        orderBy: { displayOrder: "asc" },
        select: {
          courseId: true,
          course: { select: { slug: true, title: true, status: true } },
        },
      }),
      client.moduleTag.findMany({
        where: { tagId, module: { deletedAt: null, revision: { course: { deletedAt: null } } } },
        orderBy: { displayOrder: "asc" },
        select: adminModuleSelect,
      }),
    ]);
    return {
      courses: courses.map((link) => ({
        id: link.courseId,
        slug: link.course.slug,
        title: link.course.title,
        published: link.course.status === "PUBLISHED",
      })),
      modules: modules.map((link) => ({
        id: link.module.id,
        title: link.module.title,
        courseId: link.module.revision.courseId,
        courseTitle: link.module.revision.course.title,
        published:
          link.module.revision.publishedAt !== null &&
          link.module.revision.course.status === "PUBLISHED",
      })),
    };
  }

  private async tagId(client: Pick<HeatClient, "tag">): Promise<string> {
    const tag = await client.tag.findFirst({
      where: { slug: frontpageTagSlug },
      select: { id: true },
    });
    if (tag === null) throw new ApiException(404, "NOT_FOUND");
    return tag.id;
  }

  private async lockTag(client: Pick<HeatClient, "tag" | "$queryRaw">): Promise<string> {
    const tagId = await this.tagId(client);
    await client.$queryRaw`SELECT id FROM "Tag" WHERE id = ${tagId}::uuid FOR UPDATE`;
    return tagId;
  }

  private revalidateAfterCommit(): void {
    this.audit.afterCommit(() => this.revalidation.revalidate([frontPageCacheTag]));
  }
}
