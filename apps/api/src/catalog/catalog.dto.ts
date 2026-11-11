import {
  courseIdParamsSchema,
  courseListQuerySchema,
  courseListResponseSchema,
  courseSummarySchema,
  createCourseRequestSchema,
  createModuleRequestSchema,
  createVideoSlotRequestSchema,
  lessonSectionParamsSchema,
  lessonSectionRequestSchema,
  moduleListResponseSchema,
  moduleParamsSchema,
  moduleSummarySchema,
  quizQuestionParamsSchema,
  quizQuestionRequestSchema,
  quizRulesRequestSchema,
  quizSummarySchema,
  reorderRequestSchema,
  updateCourseRequestSchema,
  updateModuleRequestSchema,
  updateQuizQuestionRequestSchema,
  updateVideoSlotRequestSchema,
  videoSlotListResponseSchema,
  videoSlotParamsSchema,
  videoUploadParamsSchema,
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

export class CreateVideoSlotRequestDto extends createZodDto(createVideoSlotRequestSchema) {}

export class UpdateVideoSlotRequestDto extends createZodDto(updateVideoSlotRequestSchema) {}

export class VideoSlotListResponseDto extends createZodDto(videoSlotListResponseSchema) {}

export class VideoSlotParamsDto extends createZodDto(videoSlotParamsSchema) {}

export class VideoUploadParamsDto extends createZodDto(videoUploadParamsSchema) {}

export class QuizSummaryDto extends createZodDto(quizSummarySchema) {}

export class QuizRulesRequestDto extends createZodDto(quizRulesRequestSchema) {}

export class QuizQuestionRequestDto extends createZodDto(quizQuestionRequestSchema) {}

export class UpdateQuizQuestionRequestDto extends createZodDto(updateQuizQuestionRequestSchema) {}

export class QuizQuestionParamsDto extends createZodDto(quizQuestionParamsSchema) {}
