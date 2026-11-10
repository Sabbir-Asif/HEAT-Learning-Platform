import { Body, Controller, Header, HttpCode, Post, Req } from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import type { AuthenticatedRequest } from "../auth";
import { RateLimit } from "../rate-limit";
import { AdminInvitationService } from "./admin-invitation.service";
import {
  AcceptInviteRequestDto,
  InvitationLookupResponseDto,
  InvitationLookupRequestDto,
} from "./admin-management.dto";

@ApiTags("admin-invitations")
@Controller("admin/auth/invitations")
export class AdminInvitationController {
  constructor(private readonly invitations: AdminInvitationService) {}

  @Public()
  @RateLimit("verify")
  @Post("lookup")
  @HttpCode(200)
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: InvitationLookupResponseDto })
  lookup(@Body() body: InvitationLookupRequestDto): Promise<InvitationLookupResponseDto> {
    return this.invitations.lookup(body.token);
  }

  @Public()
  @RateLimit("verify")
  @Post("accept")
  @HttpCode(204)
  @Header("Cache-Control", "no-store")
  @ApiNoContentResponse()
  async accept(
    @Body() body: AcceptInviteRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.invitations.accept(body, { ipAddress: request.ip });
  }
}
