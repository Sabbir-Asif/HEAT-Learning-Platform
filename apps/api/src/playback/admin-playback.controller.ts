import { Controller, HttpCode, Param, Post, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import type { CookieResponse } from "../auth";
import { RateLimit } from "../rate-limit";
import { AdminPlaybackService } from "./admin-playback.service";
import { AdminPlaybackParamsDto, PlaybackSessionResponseDto } from "./playback.dto";
import { applyPlaybackGrant } from "./playback-grant";

@ApiTags("playback")
@Controller("admin/playback-sessions")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminPlaybackController {
  constructor(private readonly playback: AdminPlaybackService) {}

  @RateLimit("playbackSession")
  @Post(":videoId")
  @HttpCode(200)
  @ApiOkResponse({ type: PlaybackSessionResponseDto })
  async preview(
    @Param() params: AdminPlaybackParamsDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<PlaybackSessionResponseDto> {
    return applyPlaybackGrant(response, await this.playback.preview(params.videoId));
  }
}
