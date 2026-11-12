import { mediaLimits } from "@heat/contracts";
import {
  Controller,
  Delete,
  HttpCode,
  Param,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiExcludeController, ApiNoContentResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { ApiException } from "../http/api-exception";
import { RateLimit } from "../rate-limit";
import { VideoCaptionParamsDto } from "./catalog.dto";
import { VideoCaptionsService } from "./video-captions.service";

const toTarget = (params: VideoCaptionParamsDto) => ({
  courseId: params.id,
  moduleId: params.moduleId,
  videoId: params.videoId,
  language: params.language,
});

@ApiExcludeController()
@Controller("admin/courses/:id/modules/:moduleId/videos/:videoId/captions/:language")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class VideoCaptionUploadController {
  constructor(private readonly captions: VideoCaptionsService) {}

  @Put()
  @HttpCode(204)
  @RateLimit("mediaUpload")
  @Audited({ action: "video-caption.put", entity: "VideoCaption" })
  @UseInterceptors(
    FileInterceptor("file", { limits: { files: 1, fileSize: mediaLimits.documentBytes } }),
  )
  async put(
    @Param() params: VideoCaptionParamsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<void> {
    if (file === undefined) throw new ApiException(400, "BAD_REQUEST");
    await this.captions.put(toTarget(params), file.buffer);
  }
}

@ApiTags("video-slots")
@Controller("admin/courses/:id/modules/:moduleId/videos/:videoId/captions/:language")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class VideoCaptionsController {
  constructor(private readonly captions: VideoCaptionsService) {}

  @Delete()
  @HttpCode(204)
  @Audited({ action: "video-caption.delete", entity: "VideoCaption" })
  @ApiNoContentResponse()
  async remove(@Param() params: VideoCaptionParamsDto): Promise<void> {
    await this.captions.remove(toTarget(params));
  }
}
