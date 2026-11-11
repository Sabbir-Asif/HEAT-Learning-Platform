import {
  learningStructureParamsSchema,
  learningStructureResponseSchema,
  lessonContentParamsSchema,
  lessonContentResponseSchema,
  quizAccessParamsSchema,
  quizAccessResponseSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class LearningStructureResponseDto extends createZodDto(learningStructureResponseSchema) {}
export class LearningStructureParamsDto extends createZodDto(learningStructureParamsSchema) {}
export class LessonContentResponseDto extends createZodDto(lessonContentResponseSchema) {}
export class LessonContentParamsDto extends createZodDto(lessonContentParamsSchema) {}
export class QuizAccessParamsDto extends createZodDto(quizAccessParamsSchema) {}
export class QuizAccessResponseDto extends createZodDto(quizAccessResponseSchema) {}
