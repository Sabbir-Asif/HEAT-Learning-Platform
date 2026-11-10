import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import {
  AdminIdParamsDto,
  AdminListQueryDto,
  AdminListResponseDto,
  AdminSummaryDto,
  InviteAdminRequestDto,
} from "./admin-management.dto";
import { AdminUsersService } from "./admin-users.service";

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

  @RateLimit("adminInvite")
  @Post()
  @ApiCreatedResponse({ type: AdminSummaryDto })
  invite(
    @Body() body: InviteAdminRequestDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.invite(body, actorOf(request, session.userId));
  }

  @RateLimit("adminInvite")
  @Post(":id/resend-invitation")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSummaryDto })
  resendInvitation(
    @Param() params: AdminIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.resendInvitation(params.id, actorOf(request, session.userId));
  }

  @Post(":id/deactivate")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSummaryDto })
  deactivate(
    @Param() params: AdminIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.deactivate(params.id, actorOf(request, session.userId));
  }

  @Post(":id/reactivate")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminSummaryDto })
  reactivate(
    @Param() params: AdminIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Req() request: AuditableRequest,
  ): Promise<AdminSummaryDto> {
    return this.admins.reactivate(params.id, actorOf(request, session.userId));
  }
}
