import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { AllowWhilePasswordChangeRequired, Audience, Roles } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import { RateLimit } from "../rate-limit";
import type { AuthenticatedSession } from "../auth";
import { AdminAccountService } from "./admin-account.service";
import { ChangePasswordRequestDto } from "./admin-auth.dto";

@ApiTags("admin-account")
@Controller("admin/account")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminAccountController {
  constructor(private readonly account: AdminAccountService) {}

  @AllowWhilePasswordChangeRequired()
  @RateLimit("passwordChange")
  @Post("change-password")
  @HttpCode(204)
  @ApiNoContentResponse()
  async changePassword(
    @Body() body: ChangePasswordRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<void> {
    await this.account.changePassword(
      session.userId,
      session.familyId,
      body.currentPassword,
      body.newPassword,
      actorOf(request, session.userId),
    );
  }
}
