import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { ContentLockService } from "./content-lock.service";
import { CourseLookupService } from "./course-lookup.service";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { LessonSectionsController } from "./lesson-sections.controller";
import { LessonSectionsService } from "./lesson-sections.service";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { VideoSlotsController } from "./video-slots.controller";
import { VideoSlotsService } from "./video-slots.service";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";

@Module({
  imports: [CoreModule, AuditModule],
  controllers: [
    CoursesController,
    ModulesController,
    LessonSectionsController,
    VideoSlotsController,
  ],
  providers: [
    CoursesService,
    CourseLookupService,
    ContentLockService,
    ModulesService,
    LessonSectionsService,
    VideoSlotsService,
    { provide: COURSE_PUBLISH_CHECKS, useValue: [] },
  ],
  exports: [CoursesService, CourseLookupService, ContentLockService, COURSE_PUBLISH_CHECKS],
})
export class CatalogModule {}
