import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { CoreModule } from "../core";
import { RateLimitModule } from "../rate-limit";
import { PlaybackController } from "./playback.controller";
import { PlaybackService } from "./playback.service";

@Module({
  imports: [CoreModule, AuthModule, RateLimitModule],
  controllers: [PlaybackController],
  providers: [PlaybackService],
})
export class PlaybackModule {}
