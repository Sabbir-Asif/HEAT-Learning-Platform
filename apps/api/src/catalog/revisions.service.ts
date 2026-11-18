import { Inject, Injectable } from "@nestjs/common";
import type { CourseRevisionItem, CourseRevisionListResponse } from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { lockScope } from "./content-access";
import type { ContentLocker } from "./content-access";
import { publishChecksFailed } from "./course-rules";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";
import type { CoursePublishCheck } from "./publish-checks";
import { toRevisionItem } from "./revision-item";
import {
  assertCanCloneRevision,
  assertCanDeleteRevision,
  assertCanPublishRevision,
  referenceIncrements,
} from "./revision-rules";

const revisionCount = { _count: { select: { enrollments: true } } };

const revisionSelect = {
  id: true,
  number: true,
  publishedAt: true,
  createdAt: true,
  ...revisionCount,
};

const sourceSelect = {
  id: true,
  number: true,
  modules: {
    where: { deletedAt: null },
    orderBy: { order: "asc" as const },
    select: {
      order: true,
      title: true,
      objectives: true,
      tags: { select: { tagId: true, displayOrder: true } },
      lessonSections: {
        where: { deletedAt: null },
        orderBy: { order: "asc" as const },
        select: { order: true, title: true, body: true, schemaVersion: true, objectives: true },
      },
      videos: {
        where: { deletedAt: null },
        orderBy: { order: "asc" as const },
        select: { order: true, title: true, required: true, assetId: true },
      },
      quiz: {
        select: {
          deletedAt: true,
          passMarkPercent: true,
          attemptLimit: true,
          waitMinutes: true,
          questions: {
            where: { deletedAt: null },
            orderBy: { order: "asc" as const },
            select: {
              order: true,
              type: true,
              text: true,
              explanation: true,
              options: {
                orderBy: { order: "asc" as const },
                select: { order: true, text: true, isCorrect: true },
              },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class RevisionsService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
    @Inject(COURSE_PUBLISH_CHECKS) private readonly publishChecks: CoursePublishCheck[],
  ) {}

  async list(courseId: string): Promise<CourseRevisionListResponse> {
    const course = await this.database.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (course === null) throw new ApiException(404, "NOT_FOUND");
    const rows = await this.database.courseRevision.findMany({
      where: { courseId },
      orderBy: { number: "desc" },
      select: revisionSelect,
    });
    const latestId = rows[0]?.id ?? "";
    return { items: rows.map((row) => toRevisionItem(row, latestId)) };
  }

  async clone(courseId: string): Promise<CourseRevisionItem> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    const source = await client.courseRevision.findUnique({
      where: { id: scope.revisionId },
      select: { ...sourceSelect, publishedAt: true },
    });
    if (source === null) throw new ApiException(404, "NOT_FOUND");
    assertCanCloneRevision(source);
    const created = await client.courseRevision.create({
      data: {
        courseId,
        number: source.number + 1,
        modules: {
          create: source.modules.map((module) => ({
            order: module.order,
            title: module.title,
            objectives: module.objectives,
            tags: { create: module.tags },
            lessonSections: {
              create: module.lessonSections.map((section) => ({
                ...section,
                body: section.body as Prisma.InputJsonValue,
              })),
            },
            videos: { create: module.videos },
            ...(module.quiz === null || module.quiz.deletedAt !== null
              ? {}
              : {
                  quiz: {
                    create: {
                      passMarkPercent: module.quiz.passMarkPercent,
                      attemptLimit: module.quiz.attemptLimit,
                      waitMinutes: module.quiz.waitMinutes,
                      questions: {
                        create: module.quiz.questions.map((question) => ({
                          order: question.order,
                          type: question.type,
                          text: question.text,
                          explanation: question.explanation,
                          options: { create: question.options },
                        })),
                      },
                    },
                  },
                }),
          })),
        },
      },
      include: revisionCount,
    });
    const increments = referenceIncrements(
      source.modules.flatMap((module) => module.videos.map((video) => video.assetId)),
    );
    for (const [assetId, count] of increments) {
      await client.videoAsset.update({
        where: { id: assetId },
        data: { referenceCount: { increment: count } },
      });
    }
    this.audit.capture({
      entityId: created.id,
      after: { courseId, number: created.number, clonedFromRevisionId: source.id },
    });
    return toRevisionItem(created, created.id);
  }

  async remove(courseId: string, revisionId: string): Promise<void> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    const revision = await client.courseRevision.findFirst({
      where: { id: revisionId, courseId },
      select: {
        id: true,
        number: true,
        publishedAt: true,
        _count: { select: { enrollments: true } },
        modules: { select: { id: true } },
      },
    });
    if (revision === null) throw new ApiException(404, "NOT_FOUND");
    const latest = await client.courseRevision.findFirst({
      where: { id: scope.revisionId },
      select: { id: true, publishedAt: true },
    });
    const revisionCount = await client.courseRevision.count({ where: { courseId } });
    assertCanDeleteRevision({
      requestedId: revisionId,
      latest: latest ?? { id: "", publishedAt: null },
      enrollmentCount: revision._count.enrollments,
      revisionCount,
    });
    const moduleIds = revision.modules.map((module) => module.id);
    const slots = await client.video.findMany({
      where: { moduleId: { in: moduleIds }, assetId: { not: null } },
      select: { assetId: true },
    });
    for (const [assetId, count] of referenceIncrements(slots.map((slot) => slot.assetId))) {
      await client.videoAsset.updateMany({
        where: { id: assetId, referenceCount: { gte: count } },
        data: { referenceCount: { decrement: count } },
      });
    }
    await client.option.deleteMany({
      where: { question: { quiz: { moduleId: { in: moduleIds } } } },
    });
    await client.question.deleteMany({ where: { quiz: { moduleId: { in: moduleIds } } } });
    await client.quiz.deleteMany({ where: { moduleId: { in: moduleIds } } });
    await client.video.deleteMany({ where: { moduleId: { in: moduleIds } } });
    await client.moduleTag.deleteMany({ where: { moduleId: { in: moduleIds } } });
    await client.lessonSection.deleteMany({ where: { moduleId: { in: moduleIds } } });
    await client.module.deleteMany({ where: { revisionId } });
    await client.courseRevision.delete({ where: { id: revisionId } });
    this.audit.capture({
      entityId: revisionId,
      before: { courseId, number: revision.number, modules: moduleIds.length },
    });
  }

  async publish(courseId: string, revisionId: string): Promise<CourseRevisionItem> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    const course = await client.course.findUnique({
      where: { id: courseId },
      select: { status: true },
    });
    const revision = await client.courseRevision.findFirst({
      where: { id: revisionId, courseId },
      select: { id: true },
    });
    if (course === null || revision === null) throw new ApiException(404, "NOT_FOUND");
    const latest = await client.courseRevision.findUnique({
      where: { id: scope.revisionId },
      select: { id: true, publishedAt: true },
    });
    if (latest === null) throw new ApiException(404, "NOT_FOUND");
    assertCanPublishRevision({
      courseStatus: course.status,
      requestedId: revisionId,
      latest,
    });
    const failures = (
      await Promise.all(this.publishChecks.map((check) => check.failures(courseId, client)))
    ).flat();
    if (failures.length > 0) throw publishChecksFailed(failures);
    const now = new Date();
    const { count } = await client.courseRevision.updateMany({
      where: { id: revisionId, publishedAt: null },
      data: { publishedAt: now },
    });
    if (count === 0) throw new ApiException(409, "COURSE_REVISION_NOT_DRAFT");
    const published = await client.courseRevision.findUnique({
      where: { id: revisionId },
      select: revisionSelect,
    });
    if (published === null) throw new ApiException(404, "NOT_FOUND");
    this.audit.capture({
      entityId: revisionId,
      before: { status: "DRAFT" },
      after: {
        courseId,
        number: published.number,
        status: "PUBLISHED",
        publishedAt: now.toISOString(),
      },
    });
    return toRevisionItem(published, published.id);
  }
}
