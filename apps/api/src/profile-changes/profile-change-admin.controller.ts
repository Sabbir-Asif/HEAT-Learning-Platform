import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import {
  AdminProfileChangeListResponseDto,
  ProfileChangeDecisionDto,
  ProfileChangeIdParamsDto,
  ProfileChangeQueryDto,
  RejectProfileChangeRequestDto,
} from "./profile-change.dto";
import { ProfileChangeAdminService } from "./profile-change-admin.service";

@ApiTags("profile-changes")
@Controller("admin/profile-changes")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class ProfileChangeAdminController {
  constructor(private readonly changes: ProfileChangeAdminService) {}

  @Get()
  @ApiOkResponse({ type: AdminProfileChangeListResponseDto })
  list(@Query() query: ProfileChangeQueryDto): Promise<AdminProfileChangeListResponseDto> {
    return this.changes.list(query);
  }

  @Post(":id/approve")
  @HttpCode(200)
  @Audited({ action: "profile-change.approve", entity: "ProfileChangeRequest" })
  @ApiOkResponse({ type: ProfileChangeDecisionDto })
  approve(
    @Param() params: ProfileChangeIdParamsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<ProfileChangeDecisionDto> {
    return this.changes.approve(params.id, session.userId);
  }

  @Post(":id/reject")
  @HttpCode(200)
  @Audited({ action: "profile-change.reject", entity: "ProfileChangeRequest" })
  @ApiOkResponse({ type: ProfileChangeDecisionDto })
  reject(
    @Param() params: ProfileChangeIdParamsDto,
    @Body() body: RejectProfileChangeRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<ProfileChangeDecisionDto> {
    return this.changes.reject(params.id, session.userId, body.reason);
  }
}
