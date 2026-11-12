import { Inject, Injectable } from "@nestjs/common";
import type { PublicCourseResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { PublicImagesService } from "./public-images.service";

@Injectable()
export class PublicCoursesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly images: PublicImagesService,
  ) {}

  async get(slug: string): Promise<PublicCourseResponse> {
    const course = await this.database.course.findFirst({
      where: { slug, deletedAt: null, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        thumbnailAssetId: true,
        revisions: {
          where: { deletedAt: null, publishedAt: { not: null } },
          orderBy: { number: "desc" },
          take: 1,
          select: {
            modules: {
              where: { deletedAt: null },
              orderBy: { order: "asc" },
              select: { id: true, order: true, title: true, objectives: true },
            },
          },
        },
      },
    });
    if (course === null) throw new ApiException(404, "NOT_FOUND");
    const images = await this.images.resolve([course.thumbnailAssetId]);
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      thumbnail:
        course.thumbnailAssetId === null ? null : (images.get(course.thumbnailAssetId) ?? null),
      modules: course.revisions[0]?.modules ?? [],
    };
  }
}
