import { tusProtocol } from "@heat/contracts";
import { Controller, Head, HttpCode, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import type { Readable } from "node:stream";
import { Audience, Roles } from "../access";
import { Audited, actorOf } from "../audit";
import type { AuditableRequest } from "../audit";
import { RateLimit } from "../rate-limit";
import { VideoSlotParamsDto, VideoUploadParamsDto } from "./catalog.dto";
import { VideoUploadService } from "./video-upload.service";

type UploadRequest = AuditableRequest &
  Readable & { headers: Record<string, string | string[] | undefined> };

interface UploadResponse {
  setHeader(name: string, value: string): unknown;
}

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

const noStore = (response: UploadResponse): void => {
  response.setHeader("Tus-Resumable", tusProtocol.version);
  response.setHeader("Cache-Control", "no-store");
};

@ApiExcludeController()
@Controller("admin/courses/:id/modules/:moduleId/videos/:videoId/upload")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
@RateLimit("videoUpload")
export class VideoUploadController {
  constructor(private readonly uploads: VideoUploadService) {}

  @Post()
  @Audited({ action: "video-upload.start", entity: "VideoAsset" })
  async create(
    @Param() params: VideoSlotParamsDto,
    @Req() request: UploadRequest,
    @Res({ passthrough: true }) response: UploadResponse,
  ): Promise<void> {
    const started = await this.uploads.start(
      { courseId: params.id, moduleId: params.moduleId, videoId: params.videoId },
      {
        version: single(request.headers["tus-resumable"]),
        length: single(request.headers["upload-length"]),
      },
    );
    noStore(response);
    response.setHeader("Upload-Offset", "0");
    response.setHeader(
      "Location",
      `/api/admin/courses/${params.id}/modules/${params.moduleId}/videos/${params.videoId}/upload/${started.assetKey}`,
    );
  }

  @Head(":assetKey")
  @HttpCode(200)
  async head(
    @Param() params: VideoUploadParamsDto,
    @Req() request: UploadRequest,
    @Res({ passthrough: true }) response: UploadResponse,
  ): Promise<void> {
    const position = await this.uploads.position(
      { courseId: params.id, moduleId: params.moduleId, videoId: params.videoId },
      params.assetKey,
      single(request.headers["tus-resumable"]),
    );
    noStore(response);
    response.setHeader("Upload-Offset", String(position.offset));
    response.setHeader("Upload-Length", String(position.length));
  }

  @Patch(":assetKey")
  @HttpCode(204)
  async patch(
    @Param() params: VideoUploadParamsDto,
    @Req() request: UploadRequest,
    @Res({ passthrough: true }) response: UploadResponse,
  ): Promise<void> {
    const position = await this.uploads.append(
      { courseId: params.id, moduleId: params.moduleId, videoId: params.videoId },
      params.assetKey,
      {
        version: single(request.headers["tus-resumable"]),
        contentType: single(request.headers["content-type"]),
        offset: single(request.headers["upload-offset"]),
        body: request,
      },
      actorOf(request),
    );
    noStore(response);
    response.setHeader("Upload-Offset", String(position.offset));
  }
}
