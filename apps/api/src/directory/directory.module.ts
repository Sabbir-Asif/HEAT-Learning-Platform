import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { DepartmentsController } from "./departments.controller";
import { DepartmentsService } from "./departments.service";
import { FacultiesController } from "./faculties.controller";
import { FacultiesService } from "./faculties.service";
import { UniversitiesController } from "./universities.controller";
import { UniversitiesService } from "./universities.service";

@Module({
  imports: [CoreModule, AuditModule],
  controllers: [UniversitiesController, FacultiesController, DepartmentsController],
  providers: [UniversitiesService, FacultiesService, DepartmentsService],
  exports: [UniversitiesService, FacultiesService, DepartmentsService],
})
export class DirectoryModule {}
