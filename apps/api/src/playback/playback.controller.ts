import { hlsCookie, hlsCookiePath } from "@heat/contracts";
import { Controller, HttpCode, Param, Post, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import type { CookieResponse } from "../auth";
import { RateLimit } from "../rate-limit";
import { PlaybackSessionResponseDto } from "./playback.dto";
import { PlaybackService } from "./playback.service";

@ApiTags("playback")
@Controller("admin/playback-sessions")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  @RateLimit("playbackSession")
  @Post(":videoId")
  @HttpCode(200)
  @ApiOkResponse({ type: PlaybackSessionResponseDto })
  issue(
    @Param("videoId") videoId: string,
    @Res({ passthrough: true }) response: CookieResponse,
  ): PlaybackSessionResponseDto {
    const session = this.playback.issue(videoId);
    response.cookie(hlsCookie.name, session.value, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: hlsCookiePath(videoId),
      maxAge: session.maxAgeMilliseconds,
    });
    return { expiresAt: session.expiresAt };
  }
}
