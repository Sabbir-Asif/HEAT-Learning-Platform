import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { LearningStructureParamsDto, LearningStructureResponseDto } from "./learning.dto";
import { LearningStructureService } from "./learning-structure.service";

@ApiTags("learning")
@Controller("courses/:courseId/learning-structure")
@Audience("student")
export class LearningController {
  constructor(private readonly learning: LearningStructureService) {}

  @RateLimit("learningRead")
  @Get()
  @ApiOkResponse({ type: LearningStructureResponseDto })
  structure(
    @Param() params: LearningStructureParamsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<LearningStructureResponseDto> {
    return this.learning.describe(session.userId, params.courseId);
  }
}
