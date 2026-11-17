import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import {
  LatestProfileChangeResponseDto,
  ProfileChangeRequestDto,
  SubmitProfileChangeRequestDto,
} from "./profile-change.dto";
import { ProfileChangeService } from "./profile-change.service";

@ApiTags("me")
@Controller("me/profile/change-request")
@Audience("student")
export class ProfileChangeController {
  constructor(private readonly changes: ProfileChangeService) {}

  @Get()
  @ApiOkResponse({ type: LatestProfileChangeResponseDto })
  latest(@CurrentSession() session: AuthenticatedSession): Promise<LatestProfileChangeResponseDto> {
    return this.changes.latest(session.userId);
  }

  @Post()
  @ApiCreatedResponse({ type: ProfileChangeRequestDto })
  submit(
    @Body() body: SubmitProfileChangeRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<ProfileChangeRequestDto> {
    return this.changes.submit(session.userId, body);
  }
}
