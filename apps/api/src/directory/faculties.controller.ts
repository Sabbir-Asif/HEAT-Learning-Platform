import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CreateFacultyRequestDto,
  FacultyIdParamsDto,
  FacultyListQueryDto,
  FacultyListResponseDto,
  FacultySummaryDto,
  FacultyUniversityParamsDto,
  UpdateFacultyRequestDto,
} from "./directory.dto";
import { FacultiesService } from "./faculties.service";

@ApiTags("faculties")
@Controller("admin/directory/faculties")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class FacultiesController {
  constructor(private readonly faculties: FacultiesService) {}

  @Get()
  @ApiOkResponse({ type: FacultyListResponseDto })
  list(@Query() query: FacultyListQueryDto): Promise<FacultyListResponseDto> {
    return this.faculties.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: FacultySummaryDto })
  get(@Param() params: FacultyIdParamsDto): Promise<FacultySummaryDto> {
    return this.faculties.get(params.id);
  }

  @Post()
  @Audited({ action: "faculty.create", entity: "Faculty" })
  @ApiCreatedResponse({ type: FacultySummaryDto })
  create(@Body() body: CreateFacultyRequestDto): Promise<FacultySummaryDto> {
    return this.faculties.create(body);
  }

  @Patch(":id")
  @Audited({ action: "faculty.update", entity: "Faculty" })
  @ApiOkResponse({ type: FacultySummaryDto })
  update(
    @Param() params: FacultyIdParamsDto,
    @Body() body: UpdateFacultyRequestDto,
  ): Promise<FacultySummaryDto> {
    return this.faculties.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "faculty.delete", entity: "Faculty" })
  @ApiNoContentResponse()
  remove(@Param() params: FacultyIdParamsDto): Promise<void> {
    return this.faculties.remove(params.id);
  }

  @Put(":id/universities/:universityId")
  @HttpCode(200)
  @Audited({ action: "faculty.assign", entity: "Faculty" })
  @ApiOkResponse({ type: FacultySummaryDto })
  assign(@Param() params: FacultyUniversityParamsDto): Promise<FacultySummaryDto> {
    return this.faculties.assign(params.id, params.universityId);
  }

  @Delete(":id/universities/:universityId")
  @Audited({ action: "faculty.unassign", entity: "Faculty" })
  @ApiOkResponse({ type: FacultySummaryDto })
  unassign(@Param() params: FacultyUniversityParamsDto): Promise<FacultySummaryDto> {
    return this.faculties.unassign(params.id, params.universityId);
  }
}
