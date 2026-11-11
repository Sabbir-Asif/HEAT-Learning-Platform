import { Body, Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ApiAcceptedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CookieWriter, Public } from "../auth";
import type { AuthenticatedRequest, CookieResponse } from "../auth";
import { MeResponseDto } from "../me/me.dto";
import { MeService } from "../me/me.service";
import { RateLimit } from "../rate-limit";
import { EmailVerificationService } from "./email-verification.service";
import {
  VerificationAcceptedResponseDto,
  VerificationResendRequestDto,
  VerifyEmailRequestDto,
} from "./verification.dto";

const userAgentLimit = 255;

@ApiTags("auth")
@Controller("auth/verify-email")
export class VerificationController {
  constructor(
    private readonly verification: EmailVerificationService,
    private readonly cookies: CookieWriter,
    private readonly me: MeService,
  ) {}

  @Public()
  @RateLimit("verify")
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: MeResponseDto })
  async confirm(
    @Body() body: VerifyEmailRequestDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<MeResponseDto> {
    const { userId, tokens } = await this.verification.confirm(body.token, {
      userAgent: request.headers["user-agent"]?.slice(0, userAgentLimit),
      ipAddress: request.ip,
    });
    const profile = await this.me.describe(userId);
    this.cookies.write(response, "student", tokens);
    return profile;
  }

  @Public()
  @RateLimit("resendVerification")
  @Post("resend")
  @HttpCode(202)
  @ApiAcceptedResponse({ type: VerificationAcceptedResponseDto })
  resend(@Body() body: VerificationResendRequestDto): Promise<VerificationAcceptedResponseDto> {
    return this.verification.resend(body);
  }
}
