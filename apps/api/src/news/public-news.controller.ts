import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth";
import {
  NewsPublicListQueryDto,
  NewsPublicListResponseDto,
  NewsPublicPostDto,
  NewsSlugParamsDto,
} from "./news.dto";
import { PublicNewsService } from "./public-news.service";

@ApiTags("news")
@Controller("news")
@Public()
export class PublicNewsController {
  constructor(private readonly news: PublicNewsService) {}

  @Get()
  @ApiOkResponse({ type: NewsPublicListResponseDto })
  list(@Query() query: NewsPublicListQueryDto): Promise<NewsPublicListResponseDto> {
    return this.news.list(query);
  }

  @Get(":slug")
  @ApiOkResponse({ type: NewsPublicPostDto })
  get(@Param() params: NewsSlugParamsDto): Promise<NewsPublicPostDto> {
    return this.news.get(params.slug);
  }
}
