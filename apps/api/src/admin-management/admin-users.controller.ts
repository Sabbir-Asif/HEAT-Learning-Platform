import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedRequest, AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import type { AdminAuditContext } from "./admin-audit";
import {
  AdminIdParamsDto,
  AdminListQueryDto,
  AdminListResponseDto,
  AdminSummaryDto,
  InviteAdminRequestDto,
} from "./admin-management.dto";
import { AdminUsersService } from "./admin-users.service";

const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

interface AuditedRequest extends AuthenticatedRequest {
  headers: AuthenticatedRequest["headers"] & { "x-request-id"?: string | string[] };
}

const contextOf = (session: AuthenticatedSession, request: AuditedRequest): AdminAuditContext => {
  const header = request.headers["x-request-id"];
  return {
    actorId: session.userId,
    ipAddress: request.ip,
    requestId: typeof header === "string" && requestIdPattern.test(header) ? header : undefined,
  };
};

@ApiTags("admin-users")
@Controller("admin/admins")
@Audience("admin")
@Roles("SUPER_ADMIN")
export class AdminUsersController {
  constructor(private readonly admins: AdminUsersService) {}

  @Get()
  @ApiOkResponse({ type: AdminListResponseDto })
  list(@Query() query: AdminListQueryDto): Promise<AdminListResponseDto> {
    return this.admins.list(query);
  }

  @RateLimit("verify")
  @Post()
  @ApiCreatedResponse({ type: AdminSummaryDto })
  invite(
    @Body() body: InviteAdminRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditedRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.invite(body, contextOf(session, request));
  }

  @RateLimit("verify")
  @Post(":id/resend-invitation")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSummaryDto })
  resendInvitation(
    @Param() params: AdminIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditedRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.resendInvitation(params.id, contextOf(session, request));
  }

  @Post(":id/deactivate")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSummaryDto })
  deactivate(
    @Param() params: AdminIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditedRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.deactivate(params.id, contextOf(session, request));
  }

  @Post(":id/reactivate")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSummaryDto })
  reactivate(
    @Param() params: AdminIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditedRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.reactivate(params.id, contextOf(session, request));
  }
}
