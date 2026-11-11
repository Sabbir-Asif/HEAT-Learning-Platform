import { hlsManifestPath } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import type { PlaybackGrant } from "./playback-grant";
import { playbackRefusal } from "./playback-rules";
import { PlaybackService } from "./playback.service";

@Injectable()
export class StudentPlaybackService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly playback: PlaybackService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  start(userId: string, videoId: string): Promise<PlaybackGrant> {
    return this.grant(userId, videoId, false);
  }

  refresh(userId: string, videoId: string): Promise<PlaybackGrant> {
    return this.grant(userId, videoId, true);
  }

  private async grant(userId: string, videoId: string, reuse: boolean): Promise<PlaybackGrant> {
    const video = await this.database.video.findFirst({
      where: { id: videoId, deletedAt: null, module: { deletedAt: null } },
      select: {
        moduleId: true,
        module: { select: { revisionId: true, revision: { select: { courseId: true } } } },
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
    const enrollment = await this.database.enrollment.findFirst({
      where: { userId, courseId: video.module.revision.courseId, deletedAt: null },
      select: { id: true, status: true, courseRevisionId: true },
    });
    const playable = enrollment?.status === "APPROVED" || enrollment?.status === "COMPLETED";
    if (
      enrollment !== null &&
      playable &&
      enrollment.courseRevisionId !== video.module.revisionId
    ) {
      throw new NotFoundException();
    }
    const progress =
      enrollment === null
        ? null
        : await this.database.moduleProgress.findUnique({
            where: {
              enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId: video.moduleId },
            },
            select: { status: true },
          });
    const refusal = playbackRefusal({
      enrollmentStatus: enrollment?.status ?? null,
      moduleStatus: progress?.status ?? null,
      assetStatus: video.asset?.status ?? null,
    });
    if (refusal !== null) throw refusal;
    if (enrollment === null || video.asset === null) throw new NotFoundException();
    const resume = await this.database.videoProgress.findUnique({
      where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
      select: { resumePositionSeconds: true },
    });
    const sessionId = await this.recordSession(enrollment.id, videoId, reuse);
    const session = this.playback.issue(video.asset.assetKey);
    return {
      assetKey: video.asset.assetKey,
      session,
      body: {
        expiresAt: session.expiresAt,
        manifestPath: hlsManifestPath(video.asset.assetKey),
        sessionId,
        resumePositionSeconds: resume?.resumePositionSeconds ?? 0,
        captions: video.asset.captions,
      },
    };
  }

  private async recordSession(
    enrollmentId: string,
    videoId: string,
    reuse: boolean,
  ): Promise<string> {
    if (reuse) {
      const open = await this.database.playbackSession.findFirst({
        where: { enrollmentId, videoId, endedAt: null },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      if (open !== null) {
        const touched = await this.database.playbackSession.update({
          where: { id: open.id },
          data: { lastSeenAt: this.clock.now() },
          select: { id: true },
        });
        return touched.id;
      }
    }
    const created = await this.database.playbackSession.create({
      data: { enrollmentId, videoId },
      select: { id: true },
    });
    return created.id;
  }
}
