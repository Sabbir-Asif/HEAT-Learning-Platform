import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { UniversitiesController } from "./universities.controller";
import { UniversitiesService } from "./universities.service";

@Module({
  imports: [CoreModule, AuditModule],
  controllers: [UniversitiesController],
  providers: [UniversitiesService],
  exports: [UniversitiesService],
})
export class DirectoryModule {}
