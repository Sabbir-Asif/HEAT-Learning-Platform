import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { AdminOverviewDto, AdminOverviewQueryDto } from "./insights.dto";
import { AdminOverviewService } from "./admin-overview.service";

@ApiTags("insights")
@Controller("admin/overview")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get()
  @ApiOkResponse({ type: AdminOverviewDto })
  get(@Query() query: AdminOverviewQueryDto): Promise<AdminOverviewDto> {
    return this.overview.describe(query);
  }
}
