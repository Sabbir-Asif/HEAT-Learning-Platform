import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { StudentListQueryDto, StudentListResponseDto } from "./student-list.dto";
import { StudentListService } from "./student-list.service";

@ApiTags("students")
@Controller("admin/students")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class StudentListController {
  constructor(private readonly students: StudentListService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: StudentListResponseDto })
  list(@Query() query: StudentListQueryDto): Promise<StudentListResponseDto> {
    return this.students.list(query);
  }
}
