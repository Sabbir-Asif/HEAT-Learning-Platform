import { Module } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuditModule } from "../audit";
import { APP_CONFIG, CoreModule } from "../core";
import type { AppConfig } from "../core";
import { RateLimitModule } from "../rate-limit";
import { AdminFrontPageController, PublicFrontPageController } from "./front-page.controller";
import { FrontPageService } from "./front-page.service";
import { NoopPublicRevalidation, PUBLIC_REVALIDATION } from "./public-revalidation";
import { TagAssignmentsService } from "./tag-assignments.service";
import { TagAssignmentsController, TagsController } from "./tags.controller";
import { TagsService } from "./tags.service";
import { ContentLockService } from "./content-lock.service";
import { CourseLookupService } from "./course-lookup.service";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { LessonSectionsController } from "./lesson-sections.controller";
import { LessonSectionsService } from "./lesson-sections.service";
import { ModulePublishCheck } from "./module-publish-check";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { RevisionsController } from "./revisions.controller";
import { RevisionsService } from "./revisions.service";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { VideoLibraryController } from "./video-library.controller";
import { VideoLibraryService } from "./video-library.service";
import { VideoSlotsController } from "./video-slots.controller";
import { VideoSlotsService } from "./video-slots.service";
import { VideoUploadController } from "./video-upload.controller";
import { UPLOAD_RANDOM, VideoUploadService } from "./video-upload.service";
import { FileUploadStore, UPLOAD_STORE } from "./video-upload-store";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";

@Module({
  imports: [CoreModule, AuditModule, RateLimitModule],
  controllers: [
    CoursesController,
    RevisionsController,
    ModulesController,
    LessonSectionsController,
    VideoSlotsController,
    VideoLibraryController,
    VideoUploadController,
    QuizController,
    TagsController,
    TagAssignmentsController,
    AdminFrontPageController,
    PublicFrontPageController,
  ],
  providers: [
    CoursesService,
    RevisionsService,
    CourseLookupService,
    ContentLockService,
    ModulesService,
    LessonSectionsService,
    VideoSlotsService,
    VideoLibraryService,
    VideoUploadService,
    { provide: UPLOAD_RANDOM, useValue: randomBytes },
    {
      provide: UPLOAD_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new FileUploadStore(config.videoUploads.directory),
    },
    QuizService,
    ModulePublishCheck,
    {
      provide: COURSE_PUBLISH_CHECKS,
      inject: [ModulePublishCheck],
      useFactory: (moduleCheck: ModulePublishCheck) => [moduleCheck],
    },
    TagsService,
    TagAssignmentsService,
    FrontPageService,
    { provide: PUBLIC_REVALIDATION, useClass: NoopPublicRevalidation },
  ],
  exports: [
    CoursesService,
    CourseLookupService,
    ContentLockService,
    ModulePublishCheck,
    COURSE_PUBLISH_CHECKS,
  ],
})
export class CatalogModule {}
