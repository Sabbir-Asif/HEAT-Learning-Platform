import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { LessonSectionsController } from "./lesson-sections.controller";
import { LessonSectionsService } from "./lesson-sections.service";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";

@Module({
  imports: [CoreModule, AuditModule],
  controllers: [CoursesController, ModulesController, LessonSectionsController],
  providers: [
    CoursesService,
    ModulesService,
    LessonSectionsService,
    { provide: COURSE_PUBLISH_CHECKS, useValue: [] },
  ],
  exports: [CoursesService, COURSE_PUBLISH_CHECKS],
})
export class CatalogModule {}
