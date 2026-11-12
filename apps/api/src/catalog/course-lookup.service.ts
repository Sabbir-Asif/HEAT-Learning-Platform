import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";

export interface ApprovalTarget {
  revisionId: string;
  moduleIds: string[];
}

@Injectable()
export class CourseLookupService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async resolveOpenForEnrollment(
    slug: string,
    client: Pick<HeatClient, "course"> = this.database,
  ): Promise<{ id: string }> {
    const course = await client.course.findFirst({
      where: { slug, status: "PUBLISHED", deletedAt: null },
      select: { id: true },
    });
    if (course === null) throw new ApiException(404, "COURSE_NOT_AVAILABLE");
    return course;
  }

  async resolveApprovalTarget(
    courseId: string,
    client: Pick<HeatClient, "courseRevision">,
  ): Promise<ApprovalTarget> {
    const revision = await client.courseRevision.findFirst({
      where: { courseId, publishedAt: { not: null }, deletedAt: null },
      orderBy: { number: "desc" },
      select: {
        id: true,
        modules: { where: { deletedAt: null }, orderBy: { order: "asc" }, select: { id: true } },
      },
    });
    if (revision === null || revision.modules.length === 0) {
      throw new ApiException(409, "COURSE_NOT_AVAILABLE");
    }
    return { revisionId: revision.id, moduleIds: revision.modules.map((module) => module.id) };
  }
}
