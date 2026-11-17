import { Body, Controller, Get, Put } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { Public } from "../auth";
import {
  AdminContactSettingsResponseDto,
  ContactSettingsRequestDto,
  PublicContactSettingsResponseDto,
} from "./catalog.dto";
import { ContactSettingsService } from "./contact-settings.service";

@ApiTags("site-settings")
@Controller("admin/site-settings/contact")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminContactSettingsController {
  constructor(private readonly settings: ContactSettingsService) {}

  @Get()
  @ApiOkResponse({ type: AdminContactSettingsResponseDto })
  get(): Promise<AdminContactSettingsResponseDto> {
    return this.settings.admin();
  }

  @Put()
  @Audited({ action: "site-settings.contact", entity: "SiteSetting" })
  @ApiOkResponse({ type: AdminContactSettingsResponseDto })
  update(@Body() body: ContactSettingsRequestDto): Promise<AdminContactSettingsResponseDto> {
    return this.settings.update(body);
  }
}

@ApiTags("site-settings")
@Controller("site-settings/contact")
@Public()
export class PublicContactSettingsController {
  constructor(private readonly settings: ContactSettingsService) {}

  @Get()
  @ApiOkResponse({ type: PublicContactSettingsResponseDto })
  get(): Promise<PublicContactSettingsResponseDto> {
    return this.settings.public();
  }
}
