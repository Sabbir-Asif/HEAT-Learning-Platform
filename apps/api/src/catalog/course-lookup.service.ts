import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";

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
}
