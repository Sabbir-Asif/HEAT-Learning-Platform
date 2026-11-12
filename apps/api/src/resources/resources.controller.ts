import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  ResourceAdminDto,
  ResourceAdminListQueryDto,
  ResourceAdminListResponseDto,
  ResourceIdParamsDto,
  ResourceRequestDto,
} from "./resources.dto";
import { ResourcesService } from "./resources.service";

@ApiTags("resources")
@Controller("admin/resources")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get()
  @ApiOkResponse({ type: ResourceAdminListResponseDto })
  list(@Query() query: ResourceAdminListQueryDto): Promise<ResourceAdminListResponseDto> {
    return this.resources.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: ResourceAdminDto })
  get(@Param() params: ResourceIdParamsDto): Promise<ResourceAdminDto> {
    return this.resources.get(params.id);
  }

  @Post()
  @Audited({ action: "resource.create", entity: "Resource" })
  @ApiCreatedResponse({ type: ResourceAdminDto })
  create(@Body() body: ResourceRequestDto): Promise<ResourceAdminDto> {
    return this.resources.create(body);
  }

  @Put(":id")
  @Audited({ action: "resource.update", entity: "Resource" })
  @ApiOkResponse({ type: ResourceAdminDto })
  update(
    @Param() params: ResourceIdParamsDto,
    @Body() body: ResourceRequestDto,
  ): Promise<ResourceAdminDto> {
    return this.resources.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "resource.delete", entity: "Resource" })
  @ApiNoContentResponse()
  remove(@Param() params: ResourceIdParamsDto): Promise<void> {
    return this.resources.remove(params.id);
  }
}
