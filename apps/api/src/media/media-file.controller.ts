import { Controller, Get, Param, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { RateLimit } from "../rate-limit";
import { MediaFileParamsDto } from "./media.dto";
import { MediaService } from "./media.service";
import type { PrivateFileGrant } from "./media.service";

interface AccelResponse {
  setHeader(name: string, value: string): unknown;
}

const applyGrant = (response: AccelResponse, grant: PrivateFileGrant): void => {
  response.setHeader("X-Accel-Redirect", grant.internalPath);
  response.setHeader("Content-Type", grant.mimeType);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
};

@ApiExcludeController()
@Controller("media")
@Audience("student")
export class StudentMediaFileController {
  constructor(private readonly media: MediaService) {}

  @Get(":id/:file")
  @RateLimit("learningRead")
  async read(
    @Param() params: MediaFileParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: AccelResponse,
  ): Promise<void> {
    const grant = await this.media.privateFile(params.id, params.file, {
      userId: session.userId,
      admin: false,
    });
    applyGrant(response, grant);
  }
}

@ApiExcludeController()
@Controller("admin/media")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminMediaFileController {
  constructor(private readonly media: MediaService) {}

  @Get(":id/:file")
  @RateLimit("learningRead")
  async read(
    @Param() params: MediaFileParamsDto,
    @CurrentSession() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: AccelResponse,
  ): Promise<void> {
    const grant = await this.media.privateFile(params.id, params.file, {
      userId: session.userId,
      admin: true,
    });
    applyGrant(response, grant);
  }
}
