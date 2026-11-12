import { Body, Controller, HttpCode, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import {
  AttemptGrantParamsDto,
  GrantAttemptRequestDto,
  GrantedAttemptDto,
} from "./attempt-grant.dto";
import { AttemptGrantService } from "./attempt-grant.service";

@ApiTags("attempt-grants")
@Controller("admin/enrollments")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AttemptGrantController {
  constructor(private readonly grants: AttemptGrantService) {}

  @Post(":id/quizzes/:quizId/attempt-grants")
  @HttpCode(200)
  @ApiOkResponse({ type: GrantedAttemptDto })
  grant(
    @Param() params: AttemptGrantParamsDto,
    @Body() body: GrantAttemptRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<GrantedAttemptDto> {
    return this.grants.grant(
      params.id,
      params.quizId,
      { ...actorOf(request, session.userId), actorId: session.userId },
      body.reason,
    );
  }
}
