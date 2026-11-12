import { Controller, HttpCode, Param, Post, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession, CookieResponse } from "../auth";
import { RateLimit } from "../rate-limit";
import { PlaybackSessionResponseDto, PlaybackVideoParamsDto } from "./playback.dto";
import { applyPlaybackGrant } from "./playback-grant";
import { StudentPlaybackService } from "./student-playback.service";

@ApiTags("playback")
@Controller("videos/:id/playback-session")
@Audience("student")
export class StudentPlaybackController {
  constructor(private readonly playback: StudentPlaybackService) {}

  @RateLimit("playbackSession")
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: PlaybackSessionResponseDto })
  async start(
    @Param() params: PlaybackVideoParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<PlaybackSessionResponseDto> {
    return applyPlaybackGrant(response, await this.playback.start(session.userId, params.id));
  }

  @RateLimit("playbackSession")
  @Post("refresh")
  @HttpCode(200)
  @ApiOkResponse({ type: PlaybackSessionResponseDto })
  async refresh(
    @Param() params: PlaybackVideoParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<PlaybackSessionResponseDto> {
    return applyPlaybackGrant(response, await this.playback.refresh(session.userId, params.id));
  }
}
