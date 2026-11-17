import {
  insightQuerySchema,
  insightRefreshResponseSchema,
  insightResultSchema,
  insightSeriesParamsSchema,
  insightStatusResponseSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class InsightQueryDto extends createZodDto(insightQuerySchema) {}
export class InsightSeriesParamsDto extends createZodDto(insightSeriesParamsSchema) {}
export class InsightResultDto extends createZodDto(insightResultSchema) {}
export class InsightStatusResponseDto extends createZodDto(insightStatusResponseSchema) {}
export class InsightRefreshResponseDto extends createZodDto(insightRefreshResponseSchema) {}
