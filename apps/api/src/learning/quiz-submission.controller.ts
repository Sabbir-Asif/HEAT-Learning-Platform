import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import {
  QuizDeliveryParamsDto,
  QuizSubmitRequestDto,
  QuizSubmitResponseDto,
} from "./learning.dto";
import { QuizSubmissionService } from "./quiz-submission.service";

@ApiTags("learning")
@Controller("courses/:courseId/modules/:moduleId/quiz/attempts")
@Audience("student")
export class QuizSubmissionController {
  constructor(private readonly submission: QuizSubmissionService) {}

  @RateLimit("quizSubmit")
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: QuizSubmitResponseDto })
  submit(
    @Param() params: QuizDeliveryParamsDto,
    @Body() body: QuizSubmitRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<QuizSubmitResponseDto> {
    return this.submission.submit(session.userId, params.courseId, params.moduleId, body);
  }
}
