import type { PublishCheckClient } from "./module-publish-check";

export interface CoursePublishCheck {
  failures(courseId: string, client: PublishCheckClient): Promise<string[]>;
}

export const COURSE_PUBLISH_CHECKS = Symbol("COURSE_PUBLISH_CHECKS");
