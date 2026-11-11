import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { LessonContentParamsDto, LessonContentResponseDto } from "./learning.dto";
import { LessonContentService } from "./lesson-content.service";

@ApiTags("learning")
@Controller("courses/:courseId/modules/:moduleId/lesson")
@Audience("student")
export class LessonContentController {
  constructor(private readonly lessons: LessonContentService) {}

  @RateLimit("learningRead")
  @Get()
  @ApiOkResponse({ type: LessonContentResponseDto })
  read(
    @Param() params: LessonContentParamsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<LessonContentResponseDto> {
    return this.lessons.read(session.userId, params.courseId, params.moduleId);
  }
}
