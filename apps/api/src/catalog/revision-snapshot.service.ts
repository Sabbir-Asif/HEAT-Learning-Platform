import { Inject, Injectable } from "@nestjs/common";
import { parseRichText, revisionSnapshotStudentLimit, richTextImageIds } from "@heat/contracts";
import type { RevisionSnapshotResponse, RichTextDoc } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { MediaUrlService } from "../media";
import { toRevisionItem } from "./revision-item";
import { slotStatusOf } from "./video-rules";

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

const emptyDoc: RichTextDoc = { type: "doc", content: [] };

@Injectable()
export class RevisionSnapshotService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly media: MediaUrlService,
  ) {}

  async get(courseId: string, revisionId: string): Promise<RevisionSnapshotResponse> {
    const revision = await this.database.courseRevision.findFirst({
      where: { id: revisionId, courseId },
      select: {
        id: true,
        number: true,
        publishedAt: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
        modules: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            title: true,
            objectives: true,
            lessonSections: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              select: { id: true, order: true, title: true, body: true },
            },
            videos: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              select: {
                id: true,
                order: true,
                title: true,
                required: true,
                asset: { select: { status: true } },
              },
            },
            quiz: {
              where: { deletedAt: null },
              select: {
                passMarkPercent: true,
                attemptLimit: true,
                waitMinutes: true,
                questions: {
                  where: { deletedAt: null },
                  orderBy: { order: "asc" },
                  select: {
                    id: true,
                    order: true,
                    text: true,
                    explanation: true,
                    options: {
                      orderBy: { order: "asc" },
                      select: { id: true, text: true, isCorrect: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (revision === null) throw new ApiException(404, "NOT_FOUND");
    const latest = await this.database.courseRevision.findFirst({
      where: { courseId },
      orderBy: { number: "desc" },
      select: { id: true },
    });

    const docs = new Map<string, RichTextDoc>();
    for (const module of revision.modules) {
      for (const section of module.lessonSections) {
        const parsed = parseRichText(section.body);
        docs.set(section.id, parsed.ok ? parsed.doc : emptyDoc);
      }
    }
    const imageIds = [...new Set([...docs.values()].flatMap((doc) => richTextImageIds(doc)))];
    const assets =
      imageIds.length === 0
        ? []
        : await this.database.mediaAsset.findMany({
            where: { id: { in: imageIds }, deletedAt: null },
            select: imageSelect,
          });
    const images = new Map(
      assets.map((asset) => [
        asset.id,
        {
          assetId: asset.id,
          url: this.media.describe(asset, "admin").url,
          alt: asset.altText ?? "",
        },
      ]),
    );

    const enrollmentWhere = { courseRevisionId: revisionId, deletedAt: null };
    const [total, enrollments] = await Promise.all([
      this.database.enrollment.count({ where: enrollmentWhere }),
      this.database.enrollment.findMany({
        where: enrollmentWhere,
        orderBy: { requestedAt: "asc" },
        take: revisionSnapshotStudentLimit,
        select: {
          id: true,
          status: true,
          user: { select: { id: true, email: true, profile: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      revision: toRevisionItem(revision, latest?.id ?? ""),
      modules: revision.modules.map((module) => ({
        id: module.id,
        order: module.order,
        title: module.title,
        objectives: module.objectives,
        sections: module.lessonSections.map((section) => {
          const doc = docs.get(section.id) ?? emptyDoc;
          return {
            id: section.id,
            order: section.order,
            title: section.title,
            body: { ...doc },
            images: [...new Set(richTextImageIds(doc))].flatMap((id) => {
              const image = images.get(id);
              return image === undefined ? [] : [image];
            }),
          };
        }),
        videos: module.videos.map((video) => ({
          id: video.id,
          order: video.order,
          title: video.title,
          required: video.required,
          status: slotStatusOf(video.asset),
        })),
        quiz: module.quiz,
      })),
      students: {
        total,
        items: enrollments.map((enrollment) => ({
          enrollmentId: enrollment.id,
          userId: enrollment.user.id,
          name: enrollment.user.profile?.name ?? enrollment.user.email,
          email: enrollment.user.email,
          status: enrollment.status,
        })),
      },
    };
  }
}
