import { hlsManifestPath } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import type { PlaybackGrant } from "./playback-grant";
import { PlaybackService } from "./playback.service";

@Injectable()
export class AdminPlaybackService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly playback: PlaybackService,
  ) {}

  async preview(videoId: string): Promise<PlaybackGrant> {
    const video = await this.database.video.findFirst({
      where: { id: videoId, deletedAt: null, module: { deletedAt: null } },
      select: {
        asset: {
          select: {
            assetKey: true,
            status: true,
            captions: { select: { language: true }, orderBy: { language: "asc" } },
          },
        },
      },
    });
    if (video === null) throw new NotFoundException();
    if (video.asset === null || video.asset.status !== "READY") {
      throw new ApiException(409, "VIDEO_NOT_READY");
    }
    const session = this.playback.issue(video.asset.assetKey);
    return {
      assetKey: video.asset.assetKey,
      session,
      body: {
        expiresAt: session.expiresAt,
        manifestPath: hlsManifestPath(video.asset.assetKey),
        sessionId: null,
        resumePositionSeconds: 0,
        captions: video.asset.captions,
      },
    };
  }
}
