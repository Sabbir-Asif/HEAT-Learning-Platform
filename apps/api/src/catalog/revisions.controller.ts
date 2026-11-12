import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CourseIdParamsDto,
  CourseRevisionItemDto,
  CourseRevisionListResponseDto,
  CourseRevisionParamsDto,
} from "./catalog.dto";
import { RevisionsService } from "./revisions.service";

@ApiTags("course-revisions")
@Controller("admin/courses/:id/revisions")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class RevisionsController {
  constructor(private readonly revisions: RevisionsService) {}

  @Get()
  @ApiOkResponse({ type: CourseRevisionListResponseDto })
  list(@Param() params: CourseIdParamsDto): Promise<CourseRevisionListResponseDto> {
    return this.revisions.list(params.id);
  }

  @Post()
  @Audited({ action: "course.revision.clone", entity: "CourseRevision" })
  @ApiCreatedResponse({ type: CourseRevisionItemDto })
  clone(@Param() params: CourseIdParamsDto): Promise<CourseRevisionItemDto> {
    return this.revisions.clone(params.id);
  }

  @Post(":revisionId/publish")
  @HttpCode(200)
  @Audited({ action: "course.revision.publish", entity: "CourseRevision" })
  @ApiOkResponse({ type: CourseRevisionItemDto })
  publish(@Param() params: CourseRevisionParamsDto): Promise<CourseRevisionItemDto> {
    return this.revisions.publish(params.id, params.revisionId);
  }
}
