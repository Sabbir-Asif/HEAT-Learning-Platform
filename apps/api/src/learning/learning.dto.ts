import {
  dashboardResponseSchema,
  learningStructureParamsSchema,
  learningStructureResponseSchema,
  lessonContentParamsSchema,
  lessonContentResponseSchema,
  quizAccessParamsSchema,
  quizAccessResponseSchema,
  quizDeliveryParamsSchema,
  quizDeliveryResponseSchema,
  quizSubmitRequestSchema,
  quizSubmitResponseSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class LearningStructureResponseDto extends createZodDto(learningStructureResponseSchema) {}
export class LearningStructureParamsDto extends createZodDto(learningStructureParamsSchema) {}
export class LessonContentResponseDto extends createZodDto(lessonContentResponseSchema) {}
export class LessonContentParamsDto extends createZodDto(lessonContentParamsSchema) {}
export class QuizAccessParamsDto extends createZodDto(quizAccessParamsSchema) {}
export class QuizAccessResponseDto extends createZodDto(quizAccessResponseSchema) {}
export class QuizDeliveryParamsDto extends createZodDto(quizDeliveryParamsSchema) {}
export class QuizDeliveryResponseDto extends createZodDto(quizDeliveryResponseSchema) {}
export class QuizSubmitRequestDto extends createZodDto(quizSubmitRequestSchema) {}
export class QuizSubmitResponseDto extends createZodDto(quizSubmitResponseSchema) {}
export class DashboardResponseDto extends createZodDto(dashboardResponseSchema) {}
