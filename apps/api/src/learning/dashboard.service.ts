import type { DashboardCourse, DashboardResponse, LearningModuleState } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable } from "@nestjs/common";
import { DATABASE } from "../core";
import { learnsCourse } from "./course-access";
import { resumePointOf } from "./dashboard-rules";
import {
  effectiveModuleStates,
  nextModuleIndex,
  overallProgressPercent,
  requiredVideosWatched,
} from "./learning-rules";

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async describe(userId: string): Promise<DashboardResponse> {
    const enrollments = await this.database.enrollment.findMany({
      where: { userId, deletedAt: null, course: { deletedAt: null } },
      orderBy: { requestedAt: "asc" },
      select: {
        id: true,
        status: true,
        courseRevisionId: true,
        course: { select: { id: true, slug: true, title: true } },
        certificate: { select: { number: true, revokedAt: true } },
        decisions: {
          where: { action: { in: ["REJECT", "REMOVE"] } },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { reason: true },
        },
      },
    });
    const learning = enrollments.filter(
      (enrollment) => learnsCourse(enrollment.status) && enrollment.courseRevisionId !== null,
    );
    const revisionIds = [...new Set(learning.flatMap((e) => e.courseRevisionId ?? []))];
    const enrollmentIds = learning.map((enrollment) => enrollment.id);
    const [modules, moduleProgress, videoProgress] =
      learning.length === 0
        ? [[], [], []]
        : await Promise.all([
            this.database.module.findMany({
              where: { revisionId: { in: revisionIds }, deletedAt: null },
              orderBy: { order: "asc" },
              select: {
                id: true,
                revisionId: true,
                order: true,
                title: true,
                videos: {
                  where: { deletedAt: null },
                  select: { id: true, required: true },
                },
              },
            }),
            this.database.moduleProgress.findMany({
              where: { enrollmentId: { in: enrollmentIds } },
              select: { enrollmentId: true, moduleId: true, status: true },
            }),
            this.database.videoProgress.findMany({
              where: { enrollmentId: { in: enrollmentIds } },
              select: {
                enrollmentId: true,
                videoId: true,
                coverage: true,
                resumePositionSeconds: true,
                completedAt: true,
                updatedAt: true,
              },
            }),
          ]);
    const courses = enrollments.map((enrollment): DashboardCourse => {
      const base = {
        courseId: enrollment.course.id,
        courseSlug: enrollment.course.slug,
        courseTitle: enrollment.course.title,
        status: enrollment.status,
        reason:
          enrollment.status === "REMOVED" ||
          enrollment.status === "REJECTED" ||
          enrollment.status === "EXPIRED"
            ? (enrollment.decisions[0]?.reason ?? null)
            : null,
        certificateNumber:
          enrollment.status === "COMPLETED" && enrollment.certificate?.revokedAt === null
            ? enrollment.certificate.number
            : null,
      };
      if (!learnsCourse(enrollment.status) || enrollment.courseRevisionId === null) {
        return { ...base, progress: null, nextModule: null };
      }
      const status = enrollment.status;
      const own = modules.filter((entry) => entry.revisionId === enrollment.courseRevisionId);
      const stateByModule = new Map(
        moduleProgress
          .filter((row) => row.enrollmentId === enrollment.id)
          .map((row) => [row.moduleId, row.status]),
      );
      const progressByVideo = new Map(
        videoProgress
          .filter((row) => row.enrollmentId === enrollment.id)
          .map((row) => [row.videoId, row]),
      );
      const states: LearningModuleState[] = effectiveModuleStates(
        status,
        own.map((entry) => stateByModule.get(entry.id) ?? null),
        own.map((entry) =>
          requiredVideosWatched(
            entry.videos.map((video) => ({
              required: video.required,
              coverage: progressByVideo.get(video.id)?.coverage ?? 0,
              completedAt: progressByVideo.get(video.id)?.completedAt ?? null,
            })),
          ),
        ),
      );
      const progress = {
        modulesCompleted: states.filter((state) => state === "COMPLETED").length,
        modulesTotal: states.length,
        percent: overallProgressPercent(states),
      };
      const index = nextModuleIndex(states);
      const next = index === null ? undefined : own[index];
      if (next === undefined) return { ...base, progress, nextModule: null };
      const resume = resumePointOf(
        next.videos.flatMap((video) => {
          const row = progressByVideo.get(video.id);
          return row === undefined ? [] : [{ ...row, videoId: video.id }];
        }),
      );
      return {
        ...base,
        progress,
        nextModule: {
          id: next.id,
          order: next.order,
          title: next.title,
          resumeVideoId: resume.videoId,
          resumePositionSeconds: resume.resumePositionSeconds,
        },
      };
    });
    return { courses };
  }
}
