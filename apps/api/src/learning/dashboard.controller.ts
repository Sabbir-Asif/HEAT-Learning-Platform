import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { DashboardResponseDto } from "./learning.dto";
import { DashboardService } from "./dashboard.service";

@ApiTags("learning")
@Controller("me/dashboard")
@Audience("student")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RateLimit("learningRead")
  @Get()
  @ApiOkResponse({ type: DashboardResponseDto })
  describe(@CurrentSession() session: AuthenticatedSession): Promise<DashboardResponseDto> {
    return this.dashboard.describe(session.userId);
  }
}
