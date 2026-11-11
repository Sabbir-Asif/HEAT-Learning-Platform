import type { LearningModuleState } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { requireLearnableEnrollment } from "./course-access";
import { effectiveModuleStates, quizUnlocked, requiredVideosWatched } from "./learning-rules";

@Injectable()
export class QuizGateService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async requireUnlocked(
    userId: string,
    courseId: string,
    moduleId: string,
  ): Promise<LearningModuleState> {
    const enrollment = await this.database.enrollment.findFirst({
      where: { userId, courseId, deletedAt: null },
      select: {
        id: true,
        status: true,
        courseRevisionId: true,
        course: { select: { deletedAt: true } },
        courseRevision: { select: { id: true, number: true, deletedAt: true } },
      },
    });
    const access = requireLearnableEnrollment(enrollment);
    const modules = await this.database.module.findMany({
      where: { revisionId: access.revisionId, deletedAt: null },
      orderBy: { order: "asc" },
      select: {
        id: true,
        videos: { where: { deletedAt: null }, select: { id: true, required: true } },
      },
    });
    const index = modules.findIndex((entry) => entry.id === moduleId);
    if (index === -1) throw new NotFoundException();
    const [progress, videoProgress] = await Promise.all([
      this.database.moduleProgress.findMany({
        where: { enrollmentId: access.enrollmentId, moduleId: { in: modules.map((m) => m.id) } },
        select: { moduleId: true, status: true },
      }),
      this.database.videoProgress.findMany({
        where: {
          enrollmentId: access.enrollmentId,
          videoId: { in: modules.flatMap((entry) => entry.videos.map((video) => video.id)) },
        },
        select: { videoId: true, coverage: true, completedAt: true },
      }),
    ]);
    const progressByModule = new Map(progress.map((row) => [row.moduleId, row.status]));
    const progressByVideo = new Map(videoProgress.map((row) => [row.videoId, row]));
    const states = effectiveModuleStates(
      access.status,
      modules.map((entry) => progressByModule.get(entry.id) ?? null),
      modules.map((entry) =>
        requiredVideosWatched(
          entry.videos.map((video) => ({
            required: video.required,
            coverage: progressByVideo.get(video.id)?.coverage ?? 0,
            completedAt: progressByVideo.get(video.id)?.completedAt ?? null,
          })),
        ),
      ),
    );
    const state = states[index] ?? "LOCKED";
    if (!quizUnlocked(state)) throw new ApiException(403, "QUIZ_NOT_UNLOCKED");
    return state;
  }
}
