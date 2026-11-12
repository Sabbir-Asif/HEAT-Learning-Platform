import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, CsrfTokenInBody } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { PlaybackVideoParamsDto, ProgressBatchDto, ProgressResponseDto } from "./playback.dto";
import { ProgressService } from "./progress.service";

@ApiTags("playback")
@Controller("videos/:id/progress")
@Audience("student")
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @RateLimit("playbackProgress")
  @CsrfTokenInBody()
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: ProgressResponseDto })
  record(
    @Param() params: PlaybackVideoParamsDto,
    @Body() batch: ProgressBatchDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<ProgressResponseDto> {
    return this.progress.record(session.userId, params.id, batch);
  }
}
