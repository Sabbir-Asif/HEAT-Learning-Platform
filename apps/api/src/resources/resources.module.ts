import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CatalogModule } from "../catalog";
import { CoreModule } from "../core";
import { MediaModule } from "../media";
import { PublicResourcesController } from "./public-resources.controller";
import { PublicResourcesService } from "./public-resources.service";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

@Module({
  imports: [CoreModule, AuditModule, MediaModule, CatalogModule],
  controllers: [ResourcesController, PublicResourcesController],
  providers: [ResourcesService, PublicResourcesService],
})
export class ResourcesModule {}
