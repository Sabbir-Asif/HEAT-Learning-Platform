import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";

@Module({
  imports: [CoreModule, AuditModule],
  controllers: [CoursesController],
  providers: [CoursesService, { provide: COURSE_PUBLISH_CHECKS, useValue: [] }],
  exports: [CoursesService, COURSE_PUBLISH_CHECKS],
})
export class CatalogModule {}
