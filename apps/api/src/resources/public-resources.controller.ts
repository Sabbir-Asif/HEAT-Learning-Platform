import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import { ResourcePublicListResponseDto } from "./resources.dto";
import { PublicResourcesService } from "./public-resources.service";

@ApiTags("resources")
@Controller("resources")
@Public()
export class PublicResourcesController {
  constructor(private readonly resources: PublicResourcesService) {}

  @Get()
  @ApiOkResponse({ type: ResourcePublicListResponseDto })
  list(): Promise<ResourcePublicListResponseDto> {
    return this.resources.list();
  }
}
