export interface CoursePublishCheck {
  failures(courseId: string): Promise<string[]>;
}

export const COURSE_PUBLISH_CHECKS = Symbol("COURSE_PUBLISH_CHECKS");
