import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import type { AuthenticatedRequest } from "../auth";
import { RateLimit } from "../rate-limit";
import { AdminInvitationService } from "./admin-invitation.service";
import {
  AcceptInviteRequestDto,
  InvitationLookupResponseDto,
  InvitationTokenParamsDto,
} from "./admin-management.dto";

@ApiTags("admin-invitations")
@Controller("admin/auth/invitations")
export class AdminInvitationController {
  constructor(private readonly invitations: AdminInvitationService) {}

  @Public()
  @RateLimit("verify")
  @Get(":token")
  @ApiOkResponse({ type: InvitationLookupResponseDto })
  lookup(@Param() params: InvitationTokenParamsDto): Promise<InvitationLookupResponseDto> {
    return this.invitations.lookup(params.token);
  }

  @Public()
  @RateLimit("verify")
  @Post("accept")
  @HttpCode(204)
  @ApiNoContentResponse()
  async accept(
    @Body() body: AcceptInviteRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.invitations.accept(body, { ipAddress: request.ip });
  }
}
