import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateTagRequest,
  TagDetail,
  TagListResponse,
  TagSummary,
  UpdateTagRequest,
} from "@heat/contracts";
import { tagSlugOf } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { frontPageCacheTag, PUBLIC_REVALIDATION } from "./public-revalidation";
import type { PublicRevalidation } from "./public-revalidation";
import { assertTagMutable, deletedTagSlug } from "./tag-rules";

const counts = {
  _count: {
    select: {
      courses: { where: { course: { deletedAt: null } } },
      modules: { where: { module: { deletedAt: null } } },
    },
  },
};

const detailParts = {
  ...counts,
  courses: {
    where: { course: { deletedAt: null } },
    orderBy: { displayOrder: "asc" as const },
    select: { course: { select: { id: true, title: true } } },
  },
  modules: {
    where: { module: { deletedAt: null } },
    orderBy: { displayOrder: "asc" as const },
    select: {
      module: {
        select: {
          id: true,
          title: true,
          revision: { select: { courseId: true, course: { select: { title: true } } } },
        },
      },
    },
  },
};

interface TagRow {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { courses: number; modules: number };
}

interface TagDetailRow extends TagRow {
  courses: Array<{ course: { id: string; title: string } }>;
  modules: Array<{
    module: {
      id: string;
      title: string;
      revision: { courseId: string; course: { title: string } };
    };
  }>;
}

const toSummary = (row: TagRow): TagSummary => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  isSystem: row.isSystem,
  courseCount: row._count.courses,
  moduleCount: row._count.modules,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toDetail = (row: TagDetailRow): TagDetail => ({
  ...toSummary(row),
  courses: row.courses.map((link) => ({ id: link.course.id, title: link.course.title })),
  modules: row.modules.map((link) => ({
    id: link.module.id,
    title: link.module.title,
    courseId: link.module.revision.courseId,
    courseTitle: link.module.revision.course.title,
  })),
});

const errorCodeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

const auditedFields = (row: { slug: string; name: string }) => ({
  slug: row.slug,
  name: row.name,
});

@Injectable()
export class TagsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(PUBLIC_REVALIDATION) private readonly revalidation: PublicRevalidation,
  ) {}

  async list(): Promise<TagListResponse> {
    const rows = await this.database.tag.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: counts,
    });
    return { items: rows.map(toSummary) };
  }

  async get(id: string): Promise<TagDetail> {
    return toDetail(await this.existing(this.database, id));
  }

  async create(request: CreateTagRequest): Promise<TagSummary> {
    const slug = tagSlugOf(request.name);
    await this.assertSlugFree(slug);
    try {
      const created = await this.audit.client(this.database).tag.create({
        data: { slug, name: request.name },
        include: counts,
      });
      this.audit.capture({ entityId: created.id, after: auditedFields(created) });
      return toSummary(created);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async update(id: string, request: UpdateTagRequest): Promise<TagSummary> {
    const before = await this.existing(this.database, id);
    assertTagMutable(before);
    const slug = tagSlugOf(request.name);
    await this.assertSlugFree(slug, id);
    try {
      const updated = await this.audit.client(this.database).tag.update({
        where: { id },
        data: { slug, name: request.name },
        include: counts,
      });
      this.audit.capture({
        entityId: id,
        before: auditedFields(before),
        after: auditedFields(updated),
      });
      this.revalidateAfterCommit();
      return toSummary(updated);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async remove(id: string): Promise<void> {
    const client = this.audit.client(this.database);
    const before = await this.existing(client, id);
    assertTagMutable(before);
    const detail = toDetail(before);
    await client.courseTag.deleteMany({ where: { tagId: id } });
    await client.moduleTag.deleteMany({ where: { tagId: id } });
    await client.tag.update({ where: { id }, data: { slug: deletedTagSlug(before.slug, id) } });
    await client.tag.deleteMany({ where: { id } });
    this.audit.capture({
      entityId: id,
      before: {
        ...auditedFields(before),
        courseIds: detail.courses.map((course) => course.id),
        moduleIds: detail.modules.map((module) => module.id),
      },
    });
    this.revalidateAfterCommit();
  }

  private revalidateAfterCommit(): void {
    this.audit.afterCommit(() => this.revalidation.revalidate([frontPageCacheTag]));
  }

  private async existing(client: Pick<HeatClient, "tag">, id: string): Promise<TagDetailRow> {
    const row = await client.tag.findUnique({ where: { id }, include: detailParts });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async assertSlugFree(slug: string, excludeId?: string): Promise<void> {
    const taken = await this.database.tag.findFirst({
      where: { slug, ...(excludeId === undefined ? {} : { id: { not: excludeId } }) },
      select: { id: true },
    });
    if (taken !== null) throw new ApiException(409, "TAG_NAME_TAKEN");
  }

  private translate(error: unknown): unknown {
    if (error instanceof ApiException) return error;
    if (errorCodeOf(error) === "P2002") return new ApiException(409, "TAG_NAME_TAKEN");
    if (errorCodeOf(error) === "P2025") return new ApiException(404, "NOT_FOUND");
    return error;
  }
}
