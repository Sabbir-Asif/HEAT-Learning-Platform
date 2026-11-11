import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CourseIdParamsDto,
  CourseListQueryDto,
  CourseListResponseDto,
  CourseSummaryDto,
  CreateCourseRequestDto,
  UpdateCourseRequestDto,
} from "./catalog.dto";
import { CoursesService } from "./courses.service";

@ApiTags("courses")
@Controller("admin/courses")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @ApiOkResponse({ type: CourseListResponseDto })
  list(@Query() query: CourseListQueryDto): Promise<CourseListResponseDto> {
    return this.courses.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: CourseSummaryDto })
  get(@Param() params: CourseIdParamsDto): Promise<CourseSummaryDto> {
    return this.courses.get(params.id);
  }

  @Post()
  @Audited({ action: "course.create", entity: "Course" })
  @ApiCreatedResponse({ type: CourseSummaryDto })
  create(@Body() body: CreateCourseRequestDto): Promise<CourseSummaryDto> {
    return this.courses.create(body);
  }

  @Patch(":id")
  @Audited({ action: "course.update", entity: "Course" })
  @ApiOkResponse({ type: CourseSummaryDto })
  update(
    @Param() params: CourseIdParamsDto,
    @Body() body: UpdateCourseRequestDto,
  ): Promise<CourseSummaryDto> {
    return this.courses.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "course.delete", entity: "Course" })
  @ApiNoContentResponse()
  remove(@Param() params: CourseIdParamsDto): Promise<void> {
    return this.courses.remove(params.id);
  }

  @Post(":id/publish")
  @HttpCode(200)
  @Audited({ action: "course.publish", entity: "Course" })
  @ApiOkResponse({ type: CourseSummaryDto })
  publish(@Param() params: CourseIdParamsDto): Promise<CourseSummaryDto> {
    return this.courses.publish(params.id);
  }
}
