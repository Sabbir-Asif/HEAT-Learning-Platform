import { Controller, Get, Header, Param } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import { RateLimit } from "../rate-limit";
import {
  DirectoryDepartmentLookupParamsDto,
  DirectoryFacultyLookupParamsDto,
  DirectoryOptionListResponseDto,
} from "./directory.dto";
import { DirectoryLookupsService } from "./directory-lookups.service";

const browserCache = "public, max-age=30";

@ApiTags("directory")
@Controller("directory")
@Public()
@RateLimit("directoryLookup")
export class DirectoryLookupsController {
  constructor(private readonly lookups: DirectoryLookupsService) {}

  @Get("universities")
  @Header("Cache-Control", browserCache)
  @ApiOkResponse({ type: DirectoryOptionListResponseDto })
  listUniversities(): Promise<DirectoryOptionListResponseDto> {
    return this.lookups.universities();
  }

  @Get("universities/:universityId/faculties")
  @Header("Cache-Control", browserCache)
  @ApiOkResponse({ type: DirectoryOptionListResponseDto })
  listFaculties(
    @Param() params: DirectoryFacultyLookupParamsDto,
  ): Promise<DirectoryOptionListResponseDto> {
    return this.lookups.faculties(params.universityId);
  }

  @Get("universities/:universityId/faculties/:facultyId/departments")
  @Header("Cache-Control", browserCache)
  @ApiOkResponse({ type: DirectoryOptionListResponseDto })
  listDepartments(
    @Param() params: DirectoryDepartmentLookupParamsDto,
  ): Promise<DirectoryOptionListResponseDto> {
    return this.lookups.departments(params.universityId, params.facultyId);
  }
}
