import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { QuizAccessParamsDto, QuizAccessResponseDto } from "./learning.dto";
import { QuizGateService } from "./quiz-gate";

@ApiTags("learning")
@Controller("courses/:courseId/modules/:moduleId/quiz-access")
@Audience("student")
export class QuizAccessController {
  constructor(private readonly gate: QuizGateService) {}

  @RateLimit("learningRead")
  @Get()
  @ApiOkResponse({ type: QuizAccessResponseDto })
  async check(
    @Param() params: QuizAccessParamsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<QuizAccessResponseDto> {
    const moduleState = await this.gate.requireUnlocked(
      session.userId,
      params.courseId,
      params.moduleId,
    );
    return { moduleState };
  }
}
