import { mediaLimits } from "@heat/contracts";
import { Body, Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiExcludeController } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { ApiException } from "../http/api-exception";
import { RateLimit } from "../rate-limit";
import { MediaAssetResponseDto, MediaUploadFieldsDto } from "./media.dto";
import { MediaService } from "./media.service";

@ApiExcludeController()
@Controller("admin/media")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class MediaUploadController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @RateLimit("mediaUpload")
  @Audited({ action: "media.upload", entity: "MediaAsset" })
  @UseInterceptors(
    FileInterceptor("file", { limits: { files: 1, fileSize: mediaLimits.documentBytes } }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() fields: MediaUploadFieldsDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<MediaAssetResponseDto> {
    if (file === undefined) throw new ApiException(400, "BAD_REQUEST");
    return this.media.upload(session.userId, { buffer: file.buffer }, fields, "admin");
  }
}
