import { Module } from "@nestjs/common";
import { AuditModule } from "../audit";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { IMAGE_PROCESSOR, SharpImageProcessor } from "./image-processor";
import { AdminMediaFileController, StudentMediaFileController } from "./media-file.controller";
import { MediaUploadController } from "./media-upload.controller";
import { MEDIA_ID, MediaService, randomMediaId } from "./media.service";
import { MediaUrlService } from "./media-url.service";

@Module({
  imports: [CoreModule, AuditModule, RateLimitModule],
  controllers: [MediaUploadController, StudentMediaFileController, AdminMediaFileController],
  providers: [
    MediaService,
    MediaUrlService,
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    { provide: MEDIA_ID, useValue: randomMediaId },
  ],
  exports: [MediaService, MediaUrlService],
})
export class MediaModule {}
