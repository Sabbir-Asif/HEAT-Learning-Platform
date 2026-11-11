import {
  courseIdParamsSchema,
  courseListQuerySchema,
  courseListResponseSchema,
  courseSummarySchema,
  createCourseRequestSchema,
  updateCourseRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CreateCourseRequestDto extends createZodDto(createCourseRequestSchema) {}

export class UpdateCourseRequestDto extends createZodDto(updateCourseRequestSchema) {}

export class CourseListQueryDto extends createZodDto(courseListQuerySchema) {}

export class CourseListResponseDto extends createZodDto(courseListResponseSchema) {}

export class CourseSummaryDto extends createZodDto(courseSummarySchema) {}

export class CourseIdParamsDto extends createZodDto(courseIdParamsSchema) {}
