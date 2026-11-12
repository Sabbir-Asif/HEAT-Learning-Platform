import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiAcceptedResponse, ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import type { AuthenticatedRequest } from "../auth";
import { RateLimit } from "../rate-limit";
import {
  ForgotPasswordAcceptedResponseDto,
  ForgotPasswordRequestDto,
  ResetPasswordRequestDto,
} from "./password-reset.dto";
import { PasswordResetService } from "./password-reset.service";

@ApiTags("auth")
@Controller("auth")
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Public()
  @RateLimit("reset")
  @Post("forgot-password")
  @HttpCode(202)
  @ApiAcceptedResponse({ type: ForgotPasswordAcceptedResponseDto })
  forgotPassword(
    @Body() body: ForgotPasswordRequestDto,
  ): Promise<ForgotPasswordAcceptedResponseDto> {
    return this.passwordReset.request(body);
  }

  @Public()
  @RateLimit("reset")
  @Post("reset-password")
  @HttpCode(204)
  @ApiNoContentResponse()
  async resetPassword(
    @Body() body: ResetPasswordRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.passwordReset.reset(body.token, body.password, { ipAddress: request.ip });
  }
}
