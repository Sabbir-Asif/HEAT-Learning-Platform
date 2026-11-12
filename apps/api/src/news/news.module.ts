import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CatalogModule } from "../catalog";
import { CoreModule } from "../core";
import { MediaModule } from "../media";
import { NewsController } from "./news.controller";
import { NewsService } from "./news.service";
import { PublicNewsController } from "./public-news.controller";
import { PublicNewsService } from "./public-news.service";

@Module({
  imports: [CoreModule, AuditModule, MediaModule, CatalogModule],
  controllers: [NewsController, PublicNewsController],
  providers: [NewsService, PublicNewsService],
})
export class NewsModule {}
