import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { FacultiesController } from "./faculties.controller";
import { FacultiesService } from "./faculties.service";
import { UniversitiesController } from "./universities.controller";
import { UniversitiesService } from "./universities.service";

@Module({
  imports: [CoreModule, AuditModule],
  controllers: [UniversitiesController, FacultiesController],
  providers: [UniversitiesService, FacultiesService],
  exports: [UniversitiesService, FacultiesService],
})
export class DirectoryModule {}
