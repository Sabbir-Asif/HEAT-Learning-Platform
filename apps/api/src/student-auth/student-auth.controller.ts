import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  CookieWriter,
  CurrentSession,
  Public,
  SessionService,
  StudentAuthGuard,
  readCookie,
  realmCookies,
} from "../auth";
import type { AuthenticatedRequest, AuthenticatedSession, CookieResponse } from "../auth";
import { MeResponseDto } from "../me/me.dto";
import { MeService } from "../me/me.service";
import { SignInRequestDto } from "./student-auth.dto";
import { StudentSignInService } from "./student-sign-in.service";

const userAgentLimit = 255;

@ApiTags("auth")
@Controller("auth")
@UseGuards(StudentAuthGuard)
export class StudentAuthController {
  constructor(
    private readonly signInService: StudentSignInService,
    private readonly sessions: SessionService,
    private readonly cookies: CookieWriter,
    private readonly me: MeService,
  ) {}

  @Public()
  @Post("sign-in")
  @HttpCode(200)
  @ApiOkResponse({ type: MeResponseDto })
  async signIn(
    @Body() body: SignInRequestDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<MeResponseDto> {
    const { userId, tokens } = await this.signInService.signIn(body.email, body.password, {
      userAgent: request.headers["user-agent"]?.slice(0, userAgentLimit),
      ipAddress: request.ip,
    });
    this.cookies.write(response, "student", tokens);
    return this.me.describe(userId);
  }

  @Public()
  @Post("refresh")
  @HttpCode(204)
  @ApiNoContentResponse()
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    const token = readCookie(request.headers.cookie, realmCookies.student.refresh);
    if (token === undefined) throw new UnauthorizedException();
    try {
      this.cookies.write(response, "student", await this.sessions.refresh(token, "student"));
    } catch (error) {
      if (error instanceof UnauthorizedException) this.cookies.clear(response, "student");
      throw error;
    }
  }

  @Post("sign-out")
  @HttpCode(204)
  @ApiNoContentResponse()
  async signOut(
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<void> {
    await this.sessions.revoke(session.familyId);
    this.cookies.clear(response, "student");
  }
}
