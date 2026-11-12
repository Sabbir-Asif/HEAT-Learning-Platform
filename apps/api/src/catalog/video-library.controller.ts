import { Controller, Get, Header, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { VideoLibraryListQueryDto, VideoLibraryListResponseDto } from "./video-library.dto";
import { VideoLibraryService } from "./video-library.service";

@ApiTags("video-library")
@Controller("admin/videos")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class VideoLibraryController {
  constructor(private readonly library: VideoLibraryService) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOkResponse({ type: VideoLibraryListResponseDto })
  list(@Query() query: VideoLibraryListQueryDto): Promise<VideoLibraryListResponseDto> {
    return this.library.list(query);
  }
}
