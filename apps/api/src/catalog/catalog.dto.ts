import {
  adminFrontPageResponseSchema,
  adminLandingOverviewResponseSchema,
  landingOverviewRequestSchema,
  publicLandingOverviewResponseSchema,
  courseIdParamsSchema,
  courseSlugParamsSchema,
  publicCourseResponseSchema,
  courseListQuerySchema,
  courseListResponseSchema,
  courseSummarySchema,
  createCourseRequestSchema,
  createModuleRequestSchema,
  createTagRequestSchema,
  createVideoSlotRequestSchema,
  lessonBodyRequestSchema,
  lessonBodyResponseSchema,
  lessonSectionParamsSchema,
  lessonSectionRequestSchema,
  moduleListResponseSchema,
  moduleParamsSchema,
  moduleSummarySchema,
  publicFrontPageResponseSchema,
  quizQuestionParamsSchema,
  quizQuestionRequestSchema,
  quizRulesRequestSchema,
  quizSummarySchema,
  reorderRequestSchema,
  setTagsRequestSchema,
  tagDetailSchema,
  tagIdParamsSchema,
  tagListResponseSchema,
  tagRefListResponseSchema,
  tagSummarySchema,
  updateCourseRequestSchema,
  updateModuleRequestSchema,
  updateQuizQuestionRequestSchema,
  updateTagRequestSchema,
  updateVideoSlotRequestSchema,
  videoSlotListResponseSchema,
  videoSlotParamsSchema,
  videoUploadParamsSchema,
  videoCaptionParamsSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CreateCourseRequestDto extends createZodDto(createCourseRequestSchema) {}

export class UpdateCourseRequestDto extends createZodDto(updateCourseRequestSchema) {}

export class CourseListQueryDto extends createZodDto(courseListQuerySchema) {}

export class CourseListResponseDto extends createZodDto(courseListResponseSchema) {}

export class CourseSummaryDto extends createZodDto(courseSummarySchema) {}

export class CourseIdParamsDto extends createZodDto(courseIdParamsSchema) {}

export class CourseSlugParamsDto extends createZodDto(courseSlugParamsSchema) {}

export class PublicCourseResponseDto extends createZodDto(publicCourseResponseSchema) {}

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

export class VideoCaptionParamsDto extends createZodDto(videoCaptionParamsSchema) {}

export class VideoUploadParamsDto extends createZodDto(videoUploadParamsSchema) {}

export class QuizSummaryDto extends createZodDto(quizSummarySchema) {}

export class QuizRulesRequestDto extends createZodDto(quizRulesRequestSchema) {}

export class QuizQuestionRequestDto extends createZodDto(quizQuestionRequestSchema) {}

export class UpdateQuizQuestionRequestDto extends createZodDto(updateQuizQuestionRequestSchema) {}

export class QuizQuestionParamsDto extends createZodDto(quizQuestionParamsSchema) {}

export class CreateTagRequestDto extends createZodDto(createTagRequestSchema) {}

export class UpdateTagRequestDto extends createZodDto(updateTagRequestSchema) {}

export class TagSummaryDto extends createZodDto(tagSummarySchema) {}

export class TagListResponseDto extends createZodDto(tagListResponseSchema) {}

export class TagDetailDto extends createZodDto(tagDetailSchema) {}

export class TagIdParamsDto extends createZodDto(tagIdParamsSchema) {}

export class TagRefListResponseDto extends createZodDto(tagRefListResponseSchema) {}

export class SetTagsRequestDto extends createZodDto(setTagsRequestSchema) {}

export class AdminFrontPageResponseDto extends createZodDto(adminFrontPageResponseSchema) {}

export class PublicFrontPageResponseDto extends createZodDto(publicFrontPageResponseSchema) {}

export class LessonBodyRequestDto extends createZodDto(lessonBodyRequestSchema) {}

export class LessonBodyResponseDto extends createZodDto(lessonBodyResponseSchema) {}

export class LandingOverviewRequestDto extends createZodDto(landingOverviewRequestSchema) {}

export class AdminLandingOverviewResponseDto extends createZodDto(
  adminLandingOverviewResponseSchema,
) {}

export class PublicLandingOverviewResponseDto extends createZodDto(
  publicLandingOverviewResponseSchema,
) {}
