import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AllowWhilePasswordChangeRequired, Audience, Roles } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { AdminAccountService } from "./admin-account.service";
import { AdminMeResponseDto } from "./admin-auth.dto";

@ApiTags("admin-me")
@Controller("admin/me")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
@AllowWhilePasswordChangeRequired()
export class AdminMeController {
  constructor(private readonly account: AdminAccountService) {}

  @Get()
  @ApiOkResponse({ type: AdminMeResponseDto })
  describe(@CurrentSession() session: AuthenticatedSession): Promise<AdminMeResponseDto> {
    return this.account.describe(session.userId);
  }
}
