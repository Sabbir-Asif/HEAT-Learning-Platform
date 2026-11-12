import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { Public } from "../auth";
import {
  AdminFrontPageResponseDto,
  PublicFrontPageResponseDto,
  ReorderRequestDto,
} from "./catalog.dto";
import { FrontPageService } from "./front-page.service";

@ApiTags("front-page")
@Controller("admin/front-page")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminFrontPageController {
  constructor(private readonly frontPage: FrontPageService) {}

  @Get()
  @ApiOkResponse({ type: AdminFrontPageResponseDto })
  get(): Promise<AdminFrontPageResponseDto> {
    return this.frontPage.admin();
  }

  @Post("courses/reorder")
  @HttpCode(200)
  @Audited({ action: "front-page.reorder-courses", entity: "Tag" })
  @ApiOkResponse({ type: AdminFrontPageResponseDto })
  reorderCourses(@Body() body: ReorderRequestDto): Promise<AdminFrontPageResponseDto> {
    return this.frontPage.reorderCourses(body);
  }

  @Post("modules/reorder")
  @HttpCode(200)
  @Audited({ action: "front-page.reorder-modules", entity: "Tag" })
  @ApiOkResponse({ type: AdminFrontPageResponseDto })
  reorderModules(@Body() body: ReorderRequestDto): Promise<AdminFrontPageResponseDto> {
    return this.frontPage.reorderModules(body);
  }
}

@ApiTags("front-page")
@Controller("front-page")
@Public()
export class PublicFrontPageController {
  constructor(private readonly frontPage: FrontPageService) {}

  @Get()
  @ApiOkResponse({ type: PublicFrontPageResponseDto })
  get(): Promise<PublicFrontPageResponseDto> {
    return this.frontPage.public();
  }
}
