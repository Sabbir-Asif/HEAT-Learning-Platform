import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import {
  CreateVideoSlotRequestDto,
  ModuleParamsDto,
  ReorderRequestDto,
  UpdateVideoSlotRequestDto,
  VideoSlotListResponseDto,
  VideoSlotParamsDto,
} from "./catalog.dto";
import { VideoSlotsService } from "./video-slots.service";

@ApiTags("video-slots")
@Controller("admin/courses/:id/modules/:moduleId/videos")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class VideoSlotsController {
  constructor(private readonly slots: VideoSlotsService) {}

  @Get()
  @ApiOkResponse({ type: VideoSlotListResponseDto })
  list(@Param() params: ModuleParamsDto): Promise<VideoSlotListResponseDto> {
    return this.slots.list(params.id, params.moduleId);
  }

  @Post()
  @Audited({ action: "video-slot.create", entity: "Video" })
  @ApiCreatedResponse({ type: VideoSlotListResponseDto })
  create(
    @Param() params: ModuleParamsDto,
    @Body() body: CreateVideoSlotRequestDto,
  ): Promise<VideoSlotListResponseDto> {
    return this.slots.create(params.id, params.moduleId, body);
  }

  @Post("reorder")
  @HttpCode(200)
  @Audited({ action: "video-slot.reorder", entity: "Module" })
  @ApiOkResponse({ type: VideoSlotListResponseDto })
  reorder(
    @Param() params: ModuleParamsDto,
    @Body() body: ReorderRequestDto,
  ): Promise<VideoSlotListResponseDto> {
    return this.slots.reorder(params.id, params.moduleId, body);
  }

  @Patch(":videoId")
  @Audited({ action: "video-slot.update", entity: "Video" })
  @ApiOkResponse({ type: VideoSlotListResponseDto })
  update(
    @Param() params: VideoSlotParamsDto,
    @Body() body: UpdateVideoSlotRequestDto,
  ): Promise<VideoSlotListResponseDto> {
    return this.slots.update(params.id, params.moduleId, params.videoId, body);
  }

  @Delete(":videoId")
  @HttpCode(200)
  @Audited({ action: "video-slot.delete", entity: "Video" })
  @ApiOkResponse({ type: VideoSlotListResponseDto })
  remove(@Param() params: VideoSlotParamsDto): Promise<VideoSlotListResponseDto> {
    return this.slots.remove(params.id, params.moduleId, params.videoId);
  }
}
