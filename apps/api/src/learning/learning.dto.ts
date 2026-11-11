import {
  learningStructureParamsSchema,
  learningStructureResponseSchema,
  lessonContentParamsSchema,
  lessonContentResponseSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class LearningStructureResponseDto extends createZodDto(learningStructureResponseSchema) {}
export class LearningStructureParamsDto extends createZodDto(learningStructureParamsSchema) {}
export class LessonContentResponseDto extends createZodDto(lessonContentResponseSchema) {}
export class LessonContentParamsDto extends createZodDto(lessonContentParamsSchema) {}
