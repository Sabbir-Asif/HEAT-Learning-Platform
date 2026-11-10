import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AllowWhilePasswordChangeRequired, Audience, Roles } from "../access";
import {
  CookieWriter,
  CurrentSession,
  Public,
  SessionService,
  readCookie,
  realmCookies,
} from "../auth";
import type { AuthenticatedRequest, AuthenticatedSession, CookieResponse } from "../auth";
import { AdminAccountService } from "./admin-account.service";
import { AdminMeResponseDto, AdminSignInRequestDto } from "./admin-auth.dto";
import { AdminSignInService } from "./admin-sign-in.service";

const userAgentLimit = 255;

@ApiTags("admin-auth")
@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly signInService: AdminSignInService,
    private readonly sessions: SessionService,
    private readonly cookies: CookieWriter,
    private readonly account: AdminAccountService,
  ) {}

  @Public()
  @Post("sign-in")
  @HttpCode(200)
  @ApiOkResponse({ type: AdminMeResponseDto })
  async signIn(
    @Body() body: AdminSignInRequestDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AdminMeResponseDto> {
    const { userId, tokens } = await this.signInService.signIn(body.email, body.password, {
      userAgent: request.headers["user-agent"]?.slice(0, userAgentLimit),
      ipAddress: request.ip,
    });
    const profile = await this.account.describe(userId);
    this.cookies.write(response, "admin", tokens);
    return profile;
  }

  @Public()
  @Post("refresh")
  @HttpCode(204)
  @ApiNoContentResponse()
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    const token = readCookie(request.headers.cookie, realmCookies.admin.refresh);
    if (token === undefined) throw new UnauthorizedException();
    try {
      this.cookies.write(response, "admin", await this.sessions.refresh(token, "admin"));
    } catch (error) {
      if (error instanceof UnauthorizedException) this.cookies.clear(response, "admin");
      throw error;
    }
  }

  @Audience("admin")
  @Roles("ADMIN", "SUPER_ADMIN")
  @AllowWhilePasswordChangeRequired()
  @Post("sign-out")
  @HttpCode(204)
  @ApiNoContentResponse()
  async signOut(
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.sessions.revoke(session.familyId);
    this.cookies.clear(response, "admin");
  }
}
