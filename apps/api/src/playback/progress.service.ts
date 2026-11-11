import { maxPlaybackRate, watchedIntervalsSchema } from "@heat/contracts";
import type { ProgressBatch, ProgressResponse, WatchedInterval } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { requiredVideosWatched } from "../learning";
import { playbackRefusal } from "./playback-rules";
import {
  decideSequence,
  mergeWithinBudget,
  reachesCompletion,
  remainingBudgetSeconds,
  resumePositionOf,
} from "./progress-rules";

const storedIntervals = (value: unknown): WatchedInterval[] => {
  const parsed = watchedIntervalsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async record(userId: string, videoId: string, batch: ProgressBatch): Promise<ProgressResponse> {
    const session = await this.database.playbackSession.findFirst({
      where: { id: batch.sessionId, videoId, enrollment: { userId } },
      select: {
        startedAt: true,
        enrollment: {
          select: { id: true, status: true, courseRevisionId: true, deletedAt: true },
        },
        video: {
          select: {
            moduleId: true,
            deletedAt: true,
            module: { select: { revisionId: true, deletedAt: true } },
            asset: { select: { status: true, durationSeconds: true } },
          },
        },
      },
    });
    if (session === null || session.video.deletedAt !== null) throw new NotFoundException();
    const { enrollment, video } = session;
    const active = enrollment.deletedAt === null;
    const playable = enrollment.status === "APPROVED" || enrollment.status === "COMPLETED";
    if (active && playable && enrollment.courseRevisionId !== video.module.revisionId) {
      throw new NotFoundException();
    }
    const moduleProgress = await this.database.moduleProgress.findUnique({
      where: { enrollmentId_moduleId: { enrollmentId: enrollment.id, moduleId: video.moduleId } },
      select: { status: true },
    });
    const refusal = playbackRefusal({
      enrollmentStatus: active ? enrollment.status : null,
      moduleStatus: moduleProgress?.status ?? null,
      assetStatus: video.asset?.status ?? null,
    });
    if (refusal !== null) throw refusal;
    const duration = video.asset?.durationSeconds ?? 0;
    if (duration <= 0) throw new ApiException(409, "VIDEO_NOT_READY");
    const rewatch = enrollment.status === "COMPLETED";
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Enrollment" WHERE id = ${enrollment.id}::uuid FOR NO KEY UPDATE`;
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "PlaybackSession" WHERE id = ${batch.sessionId}::uuid FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundException();
      const counters = await tx.playbackSession.findUniqueOrThrow({
        where: { id: batch.sessionId },
        select: { acceptedSeconds: true, lastSequence: true },
      });
      const spent = await tx.playbackSession.aggregate({
        where: { enrollmentId: enrollment.id, videoId },
        _min: { startedAt: true },
        _sum: { acceptedSeconds: true },
      });
      const progress = await tx.videoProgress.findUnique({
        where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
        select: {
          watchedIntervals: true,
          resumePositionSeconds: true,
          firstWatchedAt: true,
          completedAt: true,
        },
      });
      const now = this.clock.now();
      const merge = mergeWithinBudget({
        stored: storedIntervals(progress?.watchedIntervals),
        incoming: batch.intervals,
        durationSeconds: duration,
        budgetSeconds: remainingBudgetSeconds({
          startedAt: spent._min.startedAt ?? session.startedAt,
          now,
          maxRate: maxPlaybackRate,
          acceptedSeconds: spent._sum.acceptedSeconds ?? counters.acceptedSeconds,
        }),
      });
      const sequence = decideSequence(batch.sequence, counters.lastSequence);
      const resumePositionSeconds = sequence.advancesPosition
        ? resumePositionOf(batch.positionSeconds, duration)
        : (progress?.resumePositionSeconds ?? 0);
      const completedAt = progress?.completedAt ?? (reachesCompletion(merge.coverage) ? now : null);
      const data = {
        watchedIntervals: merge.merged,
        coverage: merge.coverage,
        resumePositionSeconds,
        lastSequence: sequence.lastSequence,
        firstWatchedAt: progress?.firstWatchedAt ?? now,
        completedAt,
      };
      await tx.videoProgress.upsert({
        where: { enrollmentId_videoId: { enrollmentId: enrollment.id, videoId } },
        create: { enrollmentId: enrollment.id, videoId, ...data },
        update: data,
      });
      await tx.playbackSession.update({
        where: { id: batch.sessionId },
        data: {
          acceptedSeconds: counters.acceptedSeconds + merge.acceptedSeconds,
          lastSequence: sequence.lastSequence,
          lastSeenAt: now,
        },
      });
      const status = moduleProgress?.status;
      if (!rewatch && (status === "UNLOCKED" || status === "IN_PROGRESS")) {
        const required = await tx.video.findMany({
          where: { moduleId: video.moduleId, deletedAt: null, required: true },
          select: { id: true },
        });
        const watched = await tx.videoProgress.findMany({
          where: {
            enrollmentId: enrollment.id,
            videoId: { in: required.map((entry) => entry.id) },
          },
          select: { videoId: true, coverage: true, completedAt: true },
        });
        const watchedById = new Map(watched.map((entry) => [entry.videoId, entry]));
        const unlocked = requiredVideosWatched(
          required.map((entry) => ({
            required: true,
            coverage: watchedById.get(entry.id)?.coverage ?? 0,
            completedAt: watchedById.get(entry.id)?.completedAt ?? null,
          })),
        );
        const target = {
          where: { enrollmentId: enrollment.id, moduleId: video.moduleId, status },
        };
        if (unlocked) {
          await tx.moduleProgress.updateMany({
            ...target,
            data:
              status === "UNLOCKED"
                ? { status: "QUIZ_READY", startedAt: now, quizReadyAt: now }
                : { status: "QUIZ_READY", quizReadyAt: now },
          });
        } else if (status === "UNLOCKED") {
          await tx.moduleProgress.updateMany({
            ...target,
            data: { status: "IN_PROGRESS", startedAt: now },
          });
        }
      }
      return {
        coveragePercent: Math.min(100, Math.round(merge.coverage * 100)),
        resumePositionSeconds,
        completed: completedAt !== null,
      };
    });
  }
}
