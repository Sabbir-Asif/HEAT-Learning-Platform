import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { AdminPlaybackController } from "./admin-playback.controller";
import { AdminPlaybackService } from "./admin-playback.service";
import { ProgressController } from "./progress.controller";
import { ProgressService } from "./progress.service";
import { PlaybackService } from "./playback.service";
import { StudentPlaybackController } from "./student-playback.controller";
import { StudentPlaybackService } from "./student-playback.service";

@Module({
  imports: [CoreModule, AuthModule, RateLimitModule],
  controllers: [AdminPlaybackController, StudentPlaybackController, ProgressController],
  providers: [PlaybackService, StudentPlaybackService, AdminPlaybackService, ProgressService],
})
export class PlaybackModule {}
