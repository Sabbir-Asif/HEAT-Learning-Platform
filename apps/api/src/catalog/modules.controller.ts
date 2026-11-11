import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CourseIdParamsDto,
  CreateModuleRequestDto,
  ModuleListResponseDto,
  ModuleParamsDto,
  ModuleSummaryDto,
  ReorderRequestDto,
  UpdateModuleRequestDto,
} from "./catalog.dto";
import { ModulesService } from "./modules.service";

@ApiTags("modules")
@Controller("admin/courses/:id/modules")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  @ApiOkResponse({ type: ModuleListResponseDto })
  list(@Param() params: CourseIdParamsDto): Promise<ModuleListResponseDto> {
    return this.modules.list(params.id);
  }

  @Get(":moduleId")
  @ApiOkResponse({ type: ModuleSummaryDto })
  get(@Param() params: ModuleParamsDto): Promise<ModuleSummaryDto> {
    return this.modules.get(params.id, params.moduleId);
  }

  @Post()
  @Audited({ action: "module.create", entity: "Module" })
  @ApiCreatedResponse({ type: ModuleSummaryDto })
  create(
    @Param() params: CourseIdParamsDto,
    @Body() body: CreateModuleRequestDto,
  ): Promise<ModuleSummaryDto> {
    return this.modules.create(params.id, body);
  }

  @Post("reorder")
  @HttpCode(200)
  @Audited({ action: "module.reorder", entity: "CourseRevision" })
  @ApiOkResponse({ type: ModuleListResponseDto })
  reorder(
    @Param() params: CourseIdParamsDto,
    @Body() body: ReorderRequestDto,
  ): Promise<ModuleListResponseDto> {
    return this.modules.reorder(params.id, body);
  }

  @Patch(":moduleId")
  @Audited({ action: "module.update", entity: "Module" })
  @ApiOkResponse({ type: ModuleSummaryDto })
  update(
    @Param() params: ModuleParamsDto,
    @Body() body: UpdateModuleRequestDto,
  ): Promise<ModuleSummaryDto> {
    return this.modules.update(params.id, params.moduleId, body);
  }

  @Delete(":moduleId")
  @HttpCode(204)
  @Audited({ action: "module.delete", entity: "Module" })
  @ApiNoContentResponse()
  remove(@Param() params: ModuleParamsDto): Promise<void> {
    return this.modules.remove(params.id, params.moduleId);
  }
}
