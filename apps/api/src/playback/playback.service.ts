import { hlsCookie, playbackVideoIdSchema } from "@heat/contracts";
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { APP_CONFIG, CLOCK } from "../core";
import type { AppConfig, Clock } from "../core";
import { issueHlsCookieValue } from "./hls-cookie";

export interface HlsSession {
  value: string;
  expiresAt: string;
  maxAgeMilliseconds: number;
}

@Injectable()
export class PlaybackService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  issue(videoId: string): HlsSession {
    if (!playbackVideoIdSchema.safeParse(videoId).success) {
      throw new BadRequestException("Invalid video id");
    }
    const hls = this.config.hls;
    const secret = hls?.keys.get(hls.activeKeyId);
    if (hls === undefined || secret === undefined) {
      throw new ServiceUnavailableException("Playback signing is not configured");
    }
    const expiresAtSeconds = Math.floor(this.clock.now().getTime() / 1000) + hlsCookie.ttlSeconds;
    return {
      value: issueHlsCookieValue(hls.activeKeyId, secret, videoId, expiresAtSeconds),
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      maxAgeMilliseconds: hlsCookie.ttlSeconds * 1000,
    };
  }
}
