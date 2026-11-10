import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CreateUniversityRequestDto,
  UniversityIdParamsDto,
  UniversityListQueryDto,
  UniversityListResponseDto,
  UniversitySummaryDto,
  UpdateUniversityRequestDto,
} from "./directory.dto";
import { UniversitiesService } from "./universities.service";

@ApiTags("universities")
@Controller("admin/directory/universities")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class UniversitiesController {
  constructor(private readonly universities: UniversitiesService) {}

  @Get()
  @ApiOkResponse({ type: UniversityListResponseDto })
  list(@Query() query: UniversityListQueryDto): Promise<UniversityListResponseDto> {
    return this.universities.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: UniversitySummaryDto })
  get(@Param() params: UniversityIdParamsDto): Promise<UniversitySummaryDto> {
    return this.universities.get(params.id);
  }

  @Post()
  @Audited({ action: "university.create", entity: "University" })
  @ApiCreatedResponse({ type: UniversitySummaryDto })
  create(@Body() body: CreateUniversityRequestDto): Promise<UniversitySummaryDto> {
    return this.universities.create(body);
  }

  @Patch(":id")
  @Audited({ action: "university.update", entity: "University" })
  @ApiOkResponse({ type: UniversitySummaryDto })
  update(
    @Param() params: UniversityIdParamsDto,
    @Body() body: UpdateUniversityRequestDto,
  ): Promise<UniversitySummaryDto> {
    return this.universities.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "university.delete", entity: "University" })
  @ApiNoContentResponse()
  remove(@Param() params: UniversityIdParamsDto): Promise<void> {
    return this.universities.remove(params.id);
  }
}
