import { Module } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AuditModule } from "../audit";
import { APP_CONFIG, CoreModule } from "../core";
import type { AppConfig } from "../core";
import { MediaModule } from "../media";
import { RateLimitModule } from "../rate-limit";
import { AdminFrontPageController, PublicFrontPageController } from "./front-page.controller";
import { FrontPageService } from "./front-page.service";
import { PublicCoursesController } from "./public-courses.controller";
import { PublicCoursesService } from "./public-courses.service";
import { PublicImagesService } from "./public-images.service";
import { HttpPublicRevalidation, PUBLIC_REVALIDATION } from "./public-revalidation";
import {
  AdminSiteSettingsController,
  PublicSiteSettingsController,
} from "./site-settings.controller";
import { SiteSettingsService } from "./site-settings.service";
import { TagAssignmentsService } from "./tag-assignments.service";
import { TagAssignmentsController, TagsController } from "./tags.controller";
import { TagsService } from "./tags.service";
import { ContentLockService } from "./content-lock.service";
import { CourseLookupService } from "./course-lookup.service";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { LessonSectionsController } from "./lesson-sections.controller";
import { LessonSectionsService } from "./lesson-sections.service";
import { ModulesController } from "./modules.controller";
import { ModulesService } from "./modules.service";
import { QuizController } from "./quiz.controller";
import { QuizService } from "./quiz.service";
import { VideoCaptionsController, VideoCaptionUploadController } from "./video-captions.controller";
import { VideoCaptionsService } from "./video-captions.service";
import { CAPTION_STORE, FileCaptionStore } from "./video-caption-store";
import { VideoSlotsController } from "./video-slots.controller";
import { VideoSlotsService } from "./video-slots.service";
import { VideoUploadController } from "./video-upload.controller";
import { UPLOAD_RANDOM, VideoUploadService } from "./video-upload.service";
import { FileUploadStore, UPLOAD_STORE } from "./video-upload-store";
import { COURSE_PUBLISH_CHECKS } from "./publish-checks";

@Module({
  imports: [CoreModule, AuditModule, RateLimitModule, MediaModule],
  controllers: [
    CoursesController,
    ModulesController,
    LessonSectionsController,
    VideoSlotsController,
    VideoUploadController,
    VideoCaptionUploadController,
    VideoCaptionsController,
    QuizController,
    TagsController,
    TagAssignmentsController,
    AdminFrontPageController,
    PublicFrontPageController,
    PublicCoursesController,
    AdminSiteSettingsController,
    PublicSiteSettingsController,
  ],
  providers: [
    CoursesService,
    CourseLookupService,
    ContentLockService,
    ModulesService,
    LessonSectionsService,
    VideoSlotsService,
    VideoUploadService,
    VideoCaptionsService,
    {
      provide: CAPTION_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new FileCaptionStore(config.transcode.hlsDirectory),
    },
    { provide: UPLOAD_RANDOM, useValue: randomBytes },
    {
      provide: UPLOAD_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new FileUploadStore(config.videoUploads.directory),
    },
    QuizService,
    TagsService,
    TagAssignmentsService,
    FrontPageService,
    SiteSettingsService,
    PublicImagesService,
    PublicCoursesService,
    { provide: PUBLIC_REVALIDATION, useClass: HttpPublicRevalidation },
    { provide: COURSE_PUBLISH_CHECKS, useValue: [] },
  ],
  exports: [CoursesService, CourseLookupService, ContentLockService, COURSE_PUBLISH_CHECKS],
})
export class CatalogModule {}
