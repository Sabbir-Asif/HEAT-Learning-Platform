import { learningStructureParamsSchema, learningStructureResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class LearningStructureResponseDto extends createZodDto(learningStructureResponseSchema) {}
export class LearningStructureParamsDto extends createZodDto(learningStructureParamsSchema) {}
