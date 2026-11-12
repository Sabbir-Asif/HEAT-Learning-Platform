import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { QuizResultParamsDto, QuizResultResponseDto } from "./learning.dto";
import { QuizResultService } from "./quiz-result.service";

@ApiTags("learning")
@Controller("courses/:courseId/modules/:moduleId/quiz/attempts")
@Audience("student")
export class QuizResultController {
  constructor(private readonly result: QuizResultService) {}

  @RateLimit("learningRead")
  @Get(":attemptId")
  @ApiOkResponse({ type: QuizResultResponseDto })
  get(
    @Param() params: QuizResultParamsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<QuizResultResponseDto> {
    return this.result.get(session.userId, params.courseId, params.moduleId, params.attemptId);
  }
}
