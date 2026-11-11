import { Body, Controller, Delete, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  LessonSectionParamsDto,
  LessonSectionRequestDto,
  ModuleParamsDto,
  ModuleSummaryDto,
  ReorderRequestDto,
} from "./catalog.dto";
import { LessonSectionsService } from "./lesson-sections.service";

@ApiTags("lesson-sections")
@Controller("admin/courses/:id/modules/:moduleId/sections")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class LessonSectionsController {
  constructor(private readonly sections: LessonSectionsService) {}

  @Post()
  @Audited({ action: "lesson-section.create", entity: "LessonSection" })
  @ApiCreatedResponse({ type: ModuleSummaryDto })
  create(
    @Param() params: ModuleParamsDto,
    @Body() body: LessonSectionRequestDto,
  ): Promise<ModuleSummaryDto> {
    return this.sections.create(params.id, params.moduleId, body);
  }

  @Post("reorder")
  @HttpCode(200)
  @Audited({ action: "lesson-section.reorder", entity: "Module" })
  @ApiOkResponse({ type: ModuleSummaryDto })
  reorder(
    @Param() params: ModuleParamsDto,
    @Body() body: ReorderRequestDto,
  ): Promise<ModuleSummaryDto> {
    return this.sections.reorder(params.id, params.moduleId, body);
  }

  @Patch(":sectionId")
  @Audited({ action: "lesson-section.update", entity: "LessonSection" })
  @ApiOkResponse({ type: ModuleSummaryDto })
  update(
    @Param() params: LessonSectionParamsDto,
    @Body() body: LessonSectionRequestDto,
  ): Promise<ModuleSummaryDto> {
    return this.sections.update(params.id, params.moduleId, params.sectionId, body);
  }

  @Delete(":sectionId")
  @HttpCode(200)
  @Audited({ action: "lesson-section.delete", entity: "LessonSection" })
  @ApiOkResponse({ type: ModuleSummaryDto })
  remove(@Param() params: LessonSectionParamsDto): Promise<ModuleSummaryDto> {
    return this.sections.remove(params.id, params.moduleId, params.sectionId);
  }
}
