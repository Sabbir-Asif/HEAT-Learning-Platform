import { Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CourseIdParamsDto,
  CourseRevisionItemDto,
  CourseRevisionListResponseDto,
  CourseRevisionParamsDto,
  RevisionSnapshotResponseDto,
} from "./catalog.dto";
import { RevisionSnapshotService } from "./revision-snapshot.service";
import { RevisionsService } from "./revisions.service";

@ApiTags("course-revisions")
@Controller("admin/courses/:id/revisions")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class RevisionsController {
  constructor(
    private readonly revisions: RevisionsService,
    private readonly snapshots: RevisionSnapshotService,
  ) {}

  @Get()
  @ApiOkResponse({ type: CourseRevisionListResponseDto })
  list(@Param() params: CourseIdParamsDto): Promise<CourseRevisionListResponseDto> {
    return this.revisions.list(params.id);
  }

  @Get(":revisionId")
  @ApiOkResponse({ type: RevisionSnapshotResponseDto })
  snapshot(@Param() params: CourseRevisionParamsDto): Promise<RevisionSnapshotResponseDto> {
    return this.snapshots.get(params.id, params.revisionId);
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

  @Delete(":revisionId")
  @HttpCode(204)
  @Audited({ action: "course.revision.delete", entity: "CourseRevision" })
  @ApiNoContentResponse()
  remove(@Param() params: CourseRevisionParamsDto): Promise<void> {
    return this.revisions.remove(params.id, params.revisionId);
  }
}
