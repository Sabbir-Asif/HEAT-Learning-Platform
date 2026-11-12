import { Controller, Get, Header, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { StudentDetailParamsDto, StudentDetailResponseDto } from "./student-detail.dto";
import { StudentDetailService } from "./student-detail.service";

@ApiTags("students")
@Controller("admin/students")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class StudentDetailController {
  constructor(private readonly students: StudentDetailService) {}

  @Get(":id")
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: StudentDetailResponseDto })
  get(@Param() params: StudentDetailParamsDto): Promise<StudentDetailResponseDto> {
    return this.students.get(params.id);
  }
}
