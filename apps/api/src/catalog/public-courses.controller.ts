import { Controller, Get, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import { CourseSlugParamsDto, PublicCourseResponseDto } from "./catalog.dto";
import { PublicCoursesService } from "./public-courses.service";

@ApiTags("courses")
@Controller("courses")
@Public()
export class PublicCoursesController {
  constructor(private readonly courses: PublicCoursesService) {}

  @Get(":slug")
  @ApiOkResponse({ type: PublicCourseResponseDto })
  get(@Param() params: CourseSlugParamsDto): Promise<PublicCourseResponseDto> {
    return this.courses.get(params.slug);
  }
}
