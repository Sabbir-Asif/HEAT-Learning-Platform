import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { ApprovalQueueService } from "./approval-queue.service";
import {
  ApprovalQueueQueryDto,
  ApprovalQueueResponseDto,
  ApproveEnrollmentRequestDto,
  ApproveEnrollmentsRequestDto,
  ApprovedEnrollmentDto,
  BulkApprovalResponseDto,
  EnrollmentIdParamsDto,
} from "./enrollment-approval.dto";
import { EnrollmentApprovalService } from "./enrollment-approval.service";
import type { AdminActor } from "./enrollment-approval.service";

const adminActor = (request: AuditableRequest, session: AuthenticatedSession): AdminActor => ({
  ...actorOf(request, session.userId),
  actorId: session.userId,
});

@ApiTags("enrollment-approvals")
@Controller("admin/enrollments")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class EnrollmentApprovalController {
  constructor(
    private readonly queue: ApprovalQueueService,
    private readonly approvals: EnrollmentApprovalService,
  ) {}

  @Get("pending")
  @ApiOkResponse({ type: ApprovalQueueResponseDto })
  listPending(@Query() query: ApprovalQueueQueryDto): Promise<ApprovalQueueResponseDto> {
    return this.queue.list(query);
  }

  @Post("approve")
  @HttpCode(200)
  @ApiOkResponse({ type: BulkApprovalResponseDto })
  approveMany(
    @Body() body: ApproveEnrollmentsRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<BulkApprovalResponseDto> {
    return this.approvals.approveMany(body.ids, adminActor(request, session), body.reason);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @ApiOkResponse({ type: ApprovedEnrollmentDto })
  approve(
    @Param() params: EnrollmentIdParamsDto,
    @Body() body: ApproveEnrollmentRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<ApprovedEnrollmentDto> {
    return this.approvals.approve(params.id, adminActor(request, session), body.reason);
  }
}
