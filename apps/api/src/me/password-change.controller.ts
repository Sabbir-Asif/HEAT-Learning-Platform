import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { PasswordChangeService } from "./password-change.service";
import { ChangeStudentPasswordRequestDto, PasswordCodeRequestedResponseDto } from "./profile.dto";

@ApiTags("me")
@Controller("me/password")
@Audience("student")
export class PasswordChangeController {
  constructor(private readonly passwordChange: PasswordChangeService) {}

  @Post("code")
  @HttpCode(200)
  @RateLimit("passwordCode")
  @ApiOkResponse({ type: PasswordCodeRequestedResponseDto })
  requestCode(@CurrentSession() session: AuthenticatedSession) {
    return this.passwordChange.requestCode(session.userId);
  }

  @Post()
  @HttpCode(204)
  @RateLimit("passwordChange")
  @ApiNoContentResponse()
  async change(
    @Body() body: ChangeStudentPasswordRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<void> {
    await this.passwordChange.change(
      session.userId,
      session.familyId,
      body,
      actorOf(request, session.userId),
    );
  }
}
