import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { AdminQuizSettingsResponseDto, QuizSettingsRequestDto } from "./catalog.dto";
import { QuizSettingsService } from "./quiz-settings.service";

@ApiTags("site-settings")
@Controller("admin/site-settings/quiz")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminQuizSettingsController {
  constructor(private readonly settings: QuizSettingsService) {}

  @Get()
  @ApiOkResponse({ type: AdminQuizSettingsResponseDto })
  get(): Promise<AdminQuizSettingsResponseDto> {
    return this.settings.admin();
  }

  @Put()
  @Audited({ action: "site-settings.quiz", entity: "SiteSetting" })
  @ApiOkResponse({ type: AdminQuizSettingsResponseDto })
  update(@Body() body: QuizSettingsRequestDto): Promise<AdminQuizSettingsResponseDto> {
    return this.settings.update(body);
  }
}
