import { Controller, Get, Header, Param, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { DirectoryOptionListResponse } from "@heat/contracts";
import { Public } from "../auth";
import { RateLimit } from "../rate-limit";
import { matchesIfNoneMatch, strongEtagOf } from "./conditional-response";
import {
  DirectoryDepartmentLookupParamsDto,
  DirectoryFacultyLookupParamsDto,
  DirectoryOptionListResponseDto,
} from "./directory.dto";
import { DirectoryLookupsService } from "./directory-lookups.service";

export const lookupCacheControl = "no-cache";

interface ConditionalRequest {
  headers: { "if-none-match"?: string };
}

interface ConditionalResponse {
  setHeader(name: string, value: string): unknown;
  status(code: number): unknown;
}

const revalidated = (
  request: ConditionalRequest,
  response: ConditionalResponse,
  body: DirectoryOptionListResponse,
): DirectoryOptionListResponse | undefined => {
  const etag = strongEtagOf(body);
  response.setHeader("ETag", etag);
  if (!matchesIfNoneMatch(request.headers["if-none-match"], etag)) return body;
  response.status(304);
  return undefined;
};

@ApiTags("directory")
@Controller("directory")
@Public()
@RateLimit("directoryLookup")
export class DirectoryLookupsController {
  constructor(private readonly lookups: DirectoryLookupsService) {}

  @Get("universities")
  @Header("Cache-Control", lookupCacheControl)
  @ApiOkResponse({ type: DirectoryOptionListResponseDto })
  async listUniversities(
    @Req() request: ConditionalRequest,
    @Res({ passthrough: true }) response: ConditionalResponse,
  ): Promise<DirectoryOptionListResponseDto | undefined> {
    return revalidated(request, response, await this.lookups.universities());
  }

  @Get("universities/:universityId/faculties")
  @Header("Cache-Control", lookupCacheControl)
  @ApiOkResponse({ type: DirectoryOptionListResponseDto })
  async listFaculties(
    @Param() params: DirectoryFacultyLookupParamsDto,
    @Req() request: ConditionalRequest,
    @Res({ passthrough: true }) response: ConditionalResponse,
  ): Promise<DirectoryOptionListResponseDto | undefined> {
    return revalidated(request, response, await this.lookups.faculties(params.universityId));
  }

  @Get("universities/:universityId/faculties/:facultyId/departments")
  @Header("Cache-Control", lookupCacheControl)
  @ApiOkResponse({ type: DirectoryOptionListResponseDto })
  async listDepartments(
    @Param() params: DirectoryDepartmentLookupParamsDto,
    @Req() request: ConditionalRequest,
    @Res({ passthrough: true }) response: ConditionalResponse,
  ): Promise<DirectoryOptionListResponseDto | undefined> {
    return revalidated(
      request,
      response,
      await this.lookups.departments(params.universityId, params.facultyId),
    );
  }
}
