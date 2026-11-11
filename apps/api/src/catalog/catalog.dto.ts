import {
  courseIdParamsSchema,
  courseListQuerySchema,
  courseListResponseSchema,
  courseSummarySchema,
  createCourseRequestSchema,
  createModuleRequestSchema,
  lessonSectionParamsSchema,
  lessonSectionRequestSchema,
  moduleListResponseSchema,
  moduleParamsSchema,
  moduleSummarySchema,
  reorderRequestSchema,
  updateCourseRequestSchema,
  updateModuleRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CreateCourseRequestDto extends createZodDto(createCourseRequestSchema) {}

export class UpdateCourseRequestDto extends createZodDto(updateCourseRequestSchema) {}

export class CourseListQueryDto extends createZodDto(courseListQuerySchema) {}

export class CourseListResponseDto extends createZodDto(courseListResponseSchema) {}

export class CourseSummaryDto extends createZodDto(courseSummarySchema) {}

export class CourseIdParamsDto extends createZodDto(courseIdParamsSchema) {}

export class CreateModuleRequestDto extends createZodDto(createModuleRequestSchema) {}

export class UpdateModuleRequestDto extends createZodDto(updateModuleRequestSchema) {}

export class ModuleSummaryDto extends createZodDto(moduleSummarySchema) {}

export class ModuleListResponseDto extends createZodDto(moduleListResponseSchema) {}

export class ModuleParamsDto extends createZodDto(moduleParamsSchema) {}

export class ReorderRequestDto extends createZodDto(reorderRequestSchema) {}

export class LessonSectionRequestDto extends createZodDto(lessonSectionRequestSchema) {}

export class LessonSectionParamsDto extends createZodDto(lessonSectionParamsSchema) {}
