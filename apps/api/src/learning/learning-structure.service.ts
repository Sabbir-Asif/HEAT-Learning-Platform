import type { LearningStructureResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import {
  effectiveModuleStates,
  nextModuleIndex,
  overallProgressPercent,
  quizStateOf,
  requiredVideoCompletion,
  videoStatusOf,
} from "./learning-rules";

const clampPercent = (fraction: number): number =>
  Math.min(100, Math.max(0, Math.round(fraction * 100)));

@Injectable()
export class LearningStructureService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async describe(userId: string, courseId: string): Promise<LearningStructureResponse> {
    const enrollment = await this.database.enrollment.findFirst({
      where: { userId, courseId, deletedAt: null },
      select: {
        id: true,
        status: true,
        courseRevisionId: true,
        course: { select: { id: true, slug: true, title: true, deletedAt: true } },
        courseRevision: { select: { id: true, number: true, deletedAt: true } },
        decisions: {
          where: { action: { in: ["REJECT", "REMOVE"] } },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { reason: true },
        },
      },
    });
    if (enrollment === null) throw new ApiException(403, "ENROLLMENT_NOT_ACTIVE");
    const { course, courseRevision } = enrollment;
    const summary = { id: course.id, slug: course.slug, title: course.title };
    if (enrollment.status !== "APPROVED" && enrollment.status !== "COMPLETED") {
      return {
        course: summary,
        enrollment: {
          status: enrollment.status,
          reason:
            enrollment.status === "REMOVED" || enrollment.status === "REJECTED"
              ? (enrollment.decisions[0]?.reason ?? null)
              : null,
        },
        learning: null,
      };
    }
    if (
      enrollment.courseRevisionId === null ||
      courseRevision === null ||
      course.deletedAt !== null ||
      courseRevision.deletedAt !== null
    ) {
      throw new NotFoundException();
    }
    const modules = await this.database.module.findMany({
      where: { revisionId: courseRevision.id, deletedAt: null },
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        title: true,
        objectives: true,
        lessonSections: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          select: { id: true, order: true, title: true },
        },
        videos: {
          where: { deletedAt: null },
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            title: true,
            required: true,
            asset: { select: { status: true, durationSeconds: true } },
          },
        },
        quiz: {
          select: {
            id: true,
            passMarkPercent: true,
            attemptLimit: true,
            waitMinutes: true,
            deletedAt: true,
            _count: { select: { questions: { where: { deletedAt: null } } } },
          },
        },
      },
    });
    const moduleIds = modules.map((entry) => entry.id);
    const videoIds = modules.flatMap((entry) => entry.videos.map((video) => video.id));
    const quizIds = modules.flatMap((entry) =>
      entry.quiz === null || entry.quiz.deletedAt !== null ? [] : [entry.quiz.id],
    );
    const [progress, videoProgress, attempts, grants] = await Promise.all([
      this.database.moduleProgress.findMany({
        where: { enrollmentId: enrollment.id, moduleId: { in: moduleIds } },
        select: { moduleId: true, status: true },
      }),
      this.database.videoProgress.findMany({
        where: { enrollmentId: enrollment.id, videoId: { in: videoIds } },
        select: { videoId: true, coverage: true, resumePositionSeconds: true, completedAt: true },
      }),
      this.database.quizAttempt.findMany({
        where: { enrollmentId: enrollment.id, quizId: { in: quizIds }, submittedAt: { not: null } },
        select: { quizId: true, passed: true, submittedAt: true },
      }),
      this.database.attemptGrant.findMany({
        where: { enrollmentId: enrollment.id, quizId: { in: quizIds } },
        select: { quizId: true, extraAttempts: true },
      }),
    ]);
    const progressByModule = new Map(progress.map((row) => [row.moduleId, row.status]));
    const progressByVideo = new Map(videoProgress.map((row) => [row.videoId, row]));
    const states = effectiveModuleStates(
      enrollment.status,
      modules.map((entry) => progressByModule.get(entry.id) ?? null),
    );
    const now = this.clock.now();
    const described = modules.map((entry, index) => {
      const state = states[index] ?? "LOCKED";
      const videos = entry.videos.map((video) => {
        const watched = progressByVideo.get(video.id);
        const coverage = watched?.coverage ?? 0;
        return {
          id: video.id,
          order: video.order,
          title: video.title,
          required: video.required,
          durationSeconds: video.asset?.durationSeconds ?? null,
          status: videoStatusOf({
            assetReady: video.asset?.status === "READY",
            coverage,
            resumePositionSeconds: watched?.resumePositionSeconds ?? 0,
            completedAt: watched?.completedAt ?? null,
          }),
          coveragePercent: clampPercent(coverage),
          resumePositionSeconds: watched?.resumePositionSeconds ?? 0,
        };
      });
      const completion = requiredVideoCompletion(videos);
      const quiz = entry.quiz !== null && entry.quiz.deletedAt === null ? entry.quiz : null;
      return {
        id: entry.id,
        order: entry.order,
        title: entry.title,
        objectives: entry.objectives,
        state,
        requiredVideosCompleted: completion.completed,
        requiredVideosTotal: completion.total,
        lessonSections: entry.lessonSections,
        videos,
        quiz:
          quiz === null
            ? null
            : {
                id: quiz.id,
                questionCount: quiz._count.questions,
                passMarkPercent: quiz.passMarkPercent,
                ...quizStateOf(
                  state,
                  {
                    attemptLimit: quiz.attemptLimit,
                    waitMinutes: quiz.waitMinutes,
                    extraAttempts: grants
                      .filter((grant) => grant.quizId === quiz.id)
                      .reduce((sum, grant) => sum + grant.extraAttempts, 0),
                    attempts: attempts.flatMap((attempt) =>
                      attempt.quizId === quiz.id && attempt.submittedAt !== null
                        ? [{ passed: attempt.passed, submittedAt: attempt.submittedAt }]
                        : [],
                    ),
                  },
                  now,
                ),
              },
      };
    });
    const next = nextModuleIndex(states);
    return {
      course: summary,
      enrollment: { status: enrollment.status, reason: null },
      learning: {
        revision: { id: courseRevision.id, number: courseRevision.number },
        summary: {
          overallProgressPercent: overallProgressPercent(states),
          modulesCompleted: states.filter((state) => state === "COMPLETED").length,
          modulesTotal: states.length,
          nextModuleId: next === null ? null : (modules[next]?.id ?? null),
        },
        modules: described,
      },
    };
  }
}
