import { Controller, Get, HttpCode, Param, Post, Query, Res } from "@nestjs/common";
import { ApiAcceptedResponse, ApiOkResponse, ApiProduces, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { Audited } from "../audit";
import {
  InsightQueryDto,
  InsightRefreshResponseDto,
  InsightResultDto,
  InsightSeriesParamsDto,
  InsightStatusResponseDto,
} from "./insights.dto";
import { InsightsQueryService } from "./insights-query.service";
import { InsightsRefreshService } from "./insights-refresh.service";

interface CsvResponse {
  setHeader(name: string, value: string): unknown;
}

@ApiTags("insights")
@Controller("admin/insights")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class InsightsController {
  constructor(
    private readonly queries: InsightsQueryService,
    private readonly refreshes: InsightsRefreshService,
  ) {}

  @Get("status")
  @ApiOkResponse({ type: InsightStatusResponseDto })
  status(): Promise<InsightStatusResponseDto> {
    return this.refreshes.status();
  }

  @Post("refresh")
  @HttpCode(202)
  @Audited({ action: "insights.refresh", entity: "InsightRun" })
  @ApiAcceptedResponse({ type: InsightRefreshResponseDto })
  refresh(@CurrentSession() session: AuthenticatedSession): Promise<InsightRefreshResponseDto> {
    return this.refreshes.refresh(session.userId);
  }

  @Get(":series")
  @ApiOkResponse({ type: InsightResultDto })
  query(
    @Param() params: InsightSeriesParamsDto,
    @Query() query: InsightQueryDto,
  ): Promise<InsightResultDto> {
    return this.queries.query(params.series, query);
  }

  @Get(":series/csv")
  @ApiProduces("text/csv")
  @ApiOkResponse({
    content: { "text/csv": { schema: { type: "string" } } },
  })
  async csv(
    @Param() params: InsightSeriesParamsDto,
    @Query() query: InsightQueryDto,
    @Res({ passthrough: true }) response: CsvResponse,
  ): Promise<string> {
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="insights-${params.series}.csv"`,
    );
    return this.queries.csv(params.series, query);
  }
}
