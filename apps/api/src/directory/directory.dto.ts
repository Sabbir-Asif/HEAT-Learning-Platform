import {
  createUniversityRequestSchema,
  universityIdParamsSchema,
  universityListQuerySchema,
  universityListResponseSchema,
  universitySummarySchema,
  updateUniversityRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CreateUniversityRequestDto extends createZodDto(createUniversityRequestSchema) {}

export class UpdateUniversityRequestDto extends createZodDto(updateUniversityRequestSchema) {}

export class UniversityListQueryDto extends createZodDto(universityListQuerySchema) {}

export class UniversityListResponseDto extends createZodDto(universityListResponseSchema) {}

export class UniversitySummaryDto extends createZodDto(universitySummarySchema) {}

export class UniversityIdParamsDto extends createZodDto(universityIdParamsSchema) {}
