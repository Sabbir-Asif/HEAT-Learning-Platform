import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { Public } from "../auth";
import {
  AdminLandingOverviewResponseDto,
  LandingOverviewRequestDto,
  PublicLandingOverviewResponseDto,
} from "./catalog.dto";
import { SiteSettingsService } from "./site-settings.service";

@ApiTags("site-settings")
@Controller("admin/site-settings/landing-overview")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOkResponse({ type: AdminLandingOverviewResponseDto })
  get(): Promise<AdminLandingOverviewResponseDto> {
    return this.settings.admin();
  }

  @Put()
  @Audited({ action: "site-settings.landing-overview", entity: "SiteSetting" })
  @ApiOkResponse({ type: AdminLandingOverviewResponseDto })
  update(@Body() body: LandingOverviewRequestDto): Promise<AdminLandingOverviewResponseDto> {
    return this.settings.update(body);
  }
}

@ApiTags("site-settings")
@Controller("site-settings/landing-overview")
@Public()
export class PublicSiteSettingsController {
  constructor(private readonly settings: SiteSettingsService) {}

  @Get()
  @ApiOkResponse({ type: PublicLandingOverviewResponseDto })
  get(): Promise<PublicLandingOverviewResponseDto> {
    return this.settings.public();
  }
}
