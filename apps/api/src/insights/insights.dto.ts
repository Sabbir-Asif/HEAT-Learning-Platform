import {
  insightFunnelQuerySchema,
  insightFunnelResultSchema,
  insightMissedQuestionsQuerySchema,
  insightMissedQuestionsSchema,
  insightModuleResultsQuerySchema,
  insightModuleResultsSchema,
  insightQuizResultsQuerySchema,
  insightQuizResultsSchema,
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
export class InsightFunnelQueryDto extends createZodDto(insightFunnelQuerySchema) {}
export class InsightFunnelResultDto extends createZodDto(insightFunnelResultSchema) {}
export class InsightModuleResultsQueryDto extends createZodDto(insightModuleResultsQuerySchema) {}
export class InsightModuleResultsDto extends createZodDto(insightModuleResultsSchema) {}
export class InsightQuizResultsQueryDto extends createZodDto(insightQuizResultsQuerySchema) {}
export class InsightQuizResultsDto extends createZodDto(insightQuizResultsSchema) {}
export class InsightMissedQuestionsQueryDto extends createZodDto(
  insightMissedQuestionsQuerySchema,
) {}
export class InsightMissedQuestionsDto extends createZodDto(insightMissedQuestionsSchema) {}
