import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  ModuleParamsDto,
  QuizQuestionParamsDto,
  QuizQuestionRequestDto,
  QuizRulesRequestDto,
  QuizSummaryDto,
  ReorderRequestDto,
  UpdateQuizQuestionRequestDto,
} from "./catalog.dto";
import { QuizService } from "./quiz.service";

@ApiTags("quiz")
@Controller("admin/courses/:id/modules/:moduleId/quiz")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class QuizController {
  constructor(private readonly quiz: QuizService) {}

  @Get()
  @ApiOkResponse({ type: QuizSummaryDto })
  get(@Param() params: ModuleParamsDto): Promise<QuizSummaryDto> {
    return this.quiz.get(params.id, params.moduleId);
  }

  @Put("rules")
  @Audited({ action: "quiz.rules.update", entity: "Quiz" })
  @ApiOkResponse({ type: QuizSummaryDto })
  updateRules(
    @Param() params: ModuleParamsDto,
    @Body() body: QuizRulesRequestDto,
  ): Promise<QuizSummaryDto> {
    return this.quiz.updateRules(params.id, params.moduleId, body);
  }

  @Post("questions")
  @Audited({ action: "quiz.question.create", entity: "Question" })
  @ApiCreatedResponse({ type: QuizSummaryDto })
  createQuestion(
    @Param() params: ModuleParamsDto,
    @Body() body: QuizQuestionRequestDto,
  ): Promise<QuizSummaryDto> {
    return this.quiz.createQuestion(params.id, params.moduleId, body);
  }

  @Post("questions/reorder")
  @HttpCode(200)
  @Audited({ action: "quiz.question.reorder", entity: "Module" })
  @ApiOkResponse({ type: QuizSummaryDto })
  reorderQuestions(
    @Param() params: ModuleParamsDto,
    @Body() body: ReorderRequestDto,
  ): Promise<QuizSummaryDto> {
    return this.quiz.reorderQuestions(params.id, params.moduleId, body);
  }

  @Patch("questions/:questionId")
  @Audited({ action: "quiz.question.update", entity: "Question" })
  @ApiOkResponse({ type: QuizSummaryDto })
  updateQuestion(
    @Param() params: QuizQuestionParamsDto,
    @Body() body: UpdateQuizQuestionRequestDto,
  ): Promise<QuizSummaryDto> {
    return this.quiz.updateQuestion(params.id, params.moduleId, params.questionId, body);
  }

  @Delete("questions/:questionId")
  @HttpCode(200)
  @Audited({ action: "quiz.question.delete", entity: "Question" })
  @ApiOkResponse({ type: QuizSummaryDto })
  removeQuestion(@Param() params: QuizQuestionParamsDto): Promise<QuizSummaryDto> {
    return this.quiz.removeQuestion(params.id, params.moduleId, params.questionId);
  }
}
