import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { QuizDeliveryParamsDto, QuizDeliveryResponseDto } from "./learning.dto";
import { QuizDeliveryService } from "./quiz-delivery.service";

@ApiTags("learning")
@Controller("courses/:courseId/modules/:moduleId/quiz")
@Audience("student")
export class QuizDeliveryController {
  constructor(private readonly delivery: QuizDeliveryService) {}

  @RateLimit("learningRead")
  @Get()
  @ApiOkResponse({ type: QuizDeliveryResponseDto })
  get(
    @Param() params: QuizDeliveryParamsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<QuizDeliveryResponseDto> {
    return this.delivery.get(session.userId, params.courseId, params.moduleId);
  }
}
