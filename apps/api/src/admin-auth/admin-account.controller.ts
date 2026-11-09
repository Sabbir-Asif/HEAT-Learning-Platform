import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { AllowWhilePasswordChangeRequired, Audience, Roles } from "../access";
import { CurrentSession } from "../auth";
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
  @Post("change-password")
  @HttpCode(204)
  @ApiNoContentResponse()
  async changePassword(
    @Body() body: ChangePasswordRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<void> {
    await this.account.changePassword(
      session.userId,
      session.familyId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
