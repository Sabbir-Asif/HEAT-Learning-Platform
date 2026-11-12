import { parseRichText, richTextImageIds } from "@heat/contracts";
import type { LessonContentResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { MediaUrlService } from "../media";
import { requireLearnableEnrollment } from "./course-access";
import { effectiveModuleStates } from "./learning-rules";

@Injectable()
export class LessonContentService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly media: MediaUrlService,
  ) {}

  async read(userId: string, courseId: string, moduleId: string): Promise<LessonContentResponse> {
    const enrollment = await this.database.enrollment.findFirst({
      where: { userId, courseId, deletedAt: null },
      select: {
        id: true,
        status: true,
        courseRevisionId: true,
        course: { select: { deletedAt: true } },
        courseRevision: { select: { id: true, number: true, deletedAt: true } },
      },
    });
    const access = requireLearnableEnrollment(enrollment);
    const modules = await this.database.module.findMany({
      where: { revisionId: access.revisionId, deletedAt: null },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const index = modules.findIndex((entry) => entry.id === moduleId);
    if (index === -1) throw new NotFoundException();
    const progress = await this.database.moduleProgress.findMany({
      where: { enrollmentId: access.enrollmentId, moduleId: { in: modules.map((m) => m.id) } },
      select: { moduleId: true, status: true },
    });
    const progressByModule = new Map(progress.map((row) => [row.moduleId, row.status]));
    const states = effectiveModuleStates(
      access.status,
      modules.map((entry) => progressByModule.get(entry.id) ?? null),
    );
    if (states[index] === "LOCKED") throw new ApiException(403, "MODULE_LOCKED");
    const lesson = await this.database.module.findFirst({
      where: { id: moduleId, revisionId: access.revisionId, deletedAt: null },
      select: {
        id: true,
        title: true,
        objectives: true,
        lessonSections: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          select: { id: true, order: true, title: true, schemaVersion: true, body: true },
        },
      },
    });
    if (lesson === null) throw new NotFoundException();
    const sections = await Promise.all(
      lesson.lessonSections.map(async (section) => ({
        ...section,
        body: asObject(section.body),
        images: await this.imagesOf(section.id, section.body),
      })),
    );
    return {
      module: { id: lesson.id, title: lesson.title, objectives: lesson.objectives },
      sections,
    };
  }

  private async imagesOf(sectionId: string, body: unknown): Promise<LessonContentImage[]> {
    const parsed = parseRichText(body);
    if (!parsed.ok) return [];
    const ids = [...new Set(richTextImageIds(parsed.doc))];
    if (ids.length === 0) return [];
    const assets = await this.database.mediaAsset.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        kind: "IMAGE",
        linkedEntity: "LessonSection",
        linkedId: sectionId,
      },
      select: imageSelect,
    });
    return assets.map((asset) => ({
      assetId: asset.id,
      url: this.media.describe(asset, "student").url,
      alt: asset.altText ?? "",
    }));
  }
}

type LessonContentImage = LessonContentResponse["sections"][number]["images"][number];

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
} as const;

const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
