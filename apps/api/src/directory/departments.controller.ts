import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { DepartmentsService } from "./departments.service";
import {
  CreateDepartmentRequestDto,
  DepartmentIdParamsDto,
  DepartmentListQueryDto,
  DepartmentListResponseDto,
  DepartmentSummaryDto,
  UpdateDepartmentRequestDto,
} from "./directory.dto";

@ApiTags("departments")
@Controller("admin/directory/departments")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  @Get()
  @ApiOkResponse({ type: DepartmentListResponseDto })
  list(@Query() query: DepartmentListQueryDto): Promise<DepartmentListResponseDto> {
    return this.departments.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: DepartmentSummaryDto })
  get(@Param() params: DepartmentIdParamsDto): Promise<DepartmentSummaryDto> {
    return this.departments.get(params.id);
  }

  @Post()
  @Audited({ action: "department.create", entity: "Department" })
  @ApiCreatedResponse({ type: DepartmentSummaryDto })
  create(@Body() body: CreateDepartmentRequestDto): Promise<DepartmentSummaryDto> {
    return this.departments.create(body);
  }

  @Patch(":id")
  @Audited({ action: "department.update", entity: "Department" })
  @ApiOkResponse({ type: DepartmentSummaryDto })
  update(
    @Param() params: DepartmentIdParamsDto,
    @Body() body: UpdateDepartmentRequestDto,
  ): Promise<DepartmentSummaryDto> {
    return this.departments.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "department.delete", entity: "Department" })
  @ApiNoContentResponse()
  remove(@Param() params: DepartmentIdParamsDto): Promise<void> {
    return this.departments.remove(params.id);
  }
}
