import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CourseIdParamsDto,
  CreateTagRequestDto,
  ModuleParamsDto,
  SetTagsRequestDto,
  TagDetailDto,
  TagIdParamsDto,
  TagListResponseDto,
  TagRefListResponseDto,
  TagSummaryDto,
  UpdateTagRequestDto,
} from "./catalog.dto";
import { TagAssignmentsService } from "./tag-assignments.service";
import { TagsService } from "./tags.service";

@ApiTags("tags")
@Controller("admin/tags")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  @ApiOkResponse({ type: TagListResponseDto })
  list(): Promise<TagListResponseDto> {
    return this.tags.list();
  }

  @Get(":id")
  @ApiOkResponse({ type: TagDetailDto })
  get(@Param() params: TagIdParamsDto): Promise<TagDetailDto> {
    return this.tags.get(params.id);
  }

  @Post()
  @Audited({ action: "tag.create", entity: "Tag" })
  @ApiCreatedResponse({ type: TagSummaryDto })
  create(@Body() body: CreateTagRequestDto): Promise<TagSummaryDto> {
    return this.tags.create(body);
  }

  @Patch(":id")
  @Audited({ action: "tag.update", entity: "Tag" })
  @ApiOkResponse({ type: TagSummaryDto })
  update(
    @Param() params: TagIdParamsDto,
    @Body() body: UpdateTagRequestDto,
  ): Promise<TagSummaryDto> {
    return this.tags.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "tag.delete", entity: "Tag" })
  @ApiNoContentResponse()
  remove(@Param() params: TagIdParamsDto): Promise<void> {
    return this.tags.remove(params.id);
  }
}

@ApiTags("tags")
@Controller("admin/courses/:id")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class TagAssignmentsController {
  constructor(private readonly assignments: TagAssignmentsService) {}

  @Get("tags")
  @ApiOkResponse({ type: TagRefListResponseDto })
  courseTags(@Param() params: CourseIdParamsDto): Promise<TagRefListResponseDto> {
    return this.assignments.courseTags(params.id);
  }

  @Put("tags")
  @Audited({ action: "course.tags.set", entity: "Course" })
  @ApiOkResponse({ type: TagRefListResponseDto })
  setCourseTags(
    @Param() params: CourseIdParamsDto,
    @Body() body: SetTagsRequestDto,
  ): Promise<TagRefListResponseDto> {
    return this.assignments.setCourseTags(params.id, body);
  }

  @Get("modules/:moduleId/tags")
  @ApiOkResponse({ type: TagRefListResponseDto })
  moduleTags(@Param() params: ModuleParamsDto): Promise<TagRefListResponseDto> {
    return this.assignments.moduleTags(params.id, params.moduleId);
  }

  @Put("modules/:moduleId/tags")
  @Audited({ action: "module.tags.set", entity: "Module" })
  @ApiOkResponse({ type: TagRefListResponseDto })
  setModuleTags(
    @Param() params: ModuleParamsDto,
    @Body() body: SetTagsRequestDto,
  ): Promise<TagRefListResponseDto> {
    return this.assignments.setModuleTags(params.id, params.moduleId, body);
  }
}
