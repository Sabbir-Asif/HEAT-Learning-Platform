import { Body, Controller, HttpCode, Param, Post, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { EnrollmentIdParamsDto } from "./enrollment-approval.dto";
import type { AdminActor } from "./enrollment-approval.service";
import {
  ReinstateEnrollmentRequestDto,
  ReinstatedEnrollmentDto,
  RemoveEnrollmentRequestDto,
  RemovedEnrollmentDto,
} from "./enrollment-removal.dto";
import { EnrollmentRemovalService } from "./enrollment-removal.service";

const adminActor = (request: AuditableRequest, session: AuthenticatedSession): AdminActor => ({
  ...actorOf(request, session.userId),
  actorId: session.userId,
});

@ApiTags("enrollment-removals")
@Controller("admin/enrollments")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class EnrollmentRemovalController {
  constructor(private readonly removals: EnrollmentRemovalService) {}

  @Post(":id/remove")
  @HttpCode(200)
  @ApiOkResponse({ type: RemovedEnrollmentDto })
  remove(
    @Param() params: EnrollmentIdParamsDto,
    @Body() body: RemoveEnrollmentRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<RemovedEnrollmentDto> {
    return this.removals.remove(params.id, adminActor(request, session), body.reason);
  }

  @Post(":id/reinstate")
  @HttpCode(200)
  @ApiOkResponse({ type: ReinstatedEnrollmentDto })
  reinstate(
    @Param() params: EnrollmentIdParamsDto,
    @Body() body: ReinstateEnrollmentRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<ReinstatedEnrollmentDto> {
    return this.removals.reinstate(params.id, adminActor(request, session), body.reason);
  }
}
