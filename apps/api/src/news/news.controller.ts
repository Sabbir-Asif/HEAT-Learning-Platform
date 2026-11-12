import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from "@nestjs/common";
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience, Roles } from "../access";
import { Audited } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import {
  NewsAdminListQueryDto,
  NewsAdminListResponseDto,
  NewsAdminPostDto,
  NewsIdParamsDto,
  NewsPostRequestDto,
} from "./news.dto";
import { NewsService } from "./news.service";

@ApiTags("news")
@Controller("admin/news")
@Audience("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @ApiOkResponse({ type: NewsAdminListResponseDto })
  list(@Query() query: NewsAdminListQueryDto): Promise<NewsAdminListResponseDto> {
    return this.news.list(query);
  }

  @Get(":id")
  @ApiOkResponse({ type: NewsAdminPostDto })
  get(@Param() params: NewsIdParamsDto): Promise<NewsAdminPostDto> {
    return this.news.get(params.id);
  }

  @Post()
  @Audited({ action: "news.create", entity: "NewsPost" })
  @ApiCreatedResponse({ type: NewsAdminPostDto })
  create(
    @Body() body: NewsPostRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<NewsAdminPostDto> {
    return this.news.create(session.userId, body);
  }

  @Put(":id")
  @Audited({ action: "news.update", entity: "NewsPost" })
  @ApiOkResponse({ type: NewsAdminPostDto })
  update(
    @Param() params: NewsIdParamsDto,
    @Body() body: NewsPostRequestDto,
  ): Promise<NewsAdminPostDto> {
    return this.news.update(params.id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @Audited({ action: "news.delete", entity: "NewsPost" })
  @ApiNoContentResponse()
  remove(@Param() params: NewsIdParamsDto): Promise<void> {
    return this.news.remove(params.id);
  }
}
