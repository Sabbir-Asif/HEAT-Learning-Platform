import { Inject, Injectable } from "@nestjs/common";
import type { StudentDetail } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { APP_CONFIG, CLOCK, DATABASE } from "../core";
import type { AppConfig, Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { toStudentDetail } from "./student-detail-rules";

const userSelect = {
  id: true,
  email: true,
  profile: {
    select: {
      name: true,
      session: true,
      department: {
        select: {
          id: true,
          name: true,
          universityFaculty: {
            select: {
              university: { select: { id: true, name: true } },
              faculty: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  },
} as const;

const enrollmentSelect = {
  id: true,
  status: true,
  requestedAt: true,
  approvedAt: true,
  completedAt: true,
  courseRevisionId: true,
  course: { select: { id: true, title: true } },
  decisions: {
    select: {
      id: true,
      action: true,
      reason: true,
      decidedAt: true,
      admin: { select: { id: true, email: true } },
    },
  },
  certificate: {
    select: { id: true, number: true, fileKey: true, revokedAt: true, issuedAt: true },
  },
  videoProgress: { select: { videoId: true, coverage: true, completedAt: true } },
  moduleProgress: { select: { moduleId: true, status: true, completedAt: true } },
  attemptGrants: { select: { quizId: true, extraAttempts: true } },
  quizAttempts: {
    select: {
      id: true,
      quizId: true,
      startedAt: true,
      submittedAt: true,
      scorePercent: true,
      passMarkSnapshot: true,
      passed: true,
    },
  },
} as const;

const moduleSelect = {
  id: true,
  order: true,
  title: true,
  videos: {
    where: { deletedAt: null },
    select: { id: true, order: true, title: true, required: true },
  },
  quiz: { where: { deletedAt: null }, select: { id: true, attemptLimit: true, waitMinutes: true } },
} as const;

@Injectable()
export class StudentDetailService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async get(userId: string): Promise<StudentDetail> {
    const user = await this.database.user.findFirst({
      where: {
        id: userId,
        realm: "STUDENT",
        deletedAt: null,
        profile: { is: { deletedAt: null } },
      },
      select: userSelect,
    });
    if (user === null) throw new ApiException(404, "NOT_FOUND");
    const enrollments = await this.database.enrollment.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ requestedAt: "asc" }, { id: "asc" }],
      select: enrollmentSelect,
    });
    const revisionIds = [
      ...new Set(
        enrollments.flatMap((row) => (row.courseRevisionId === null ? [] : [row.courseRevisionId])),
      ),
    ];
    const modules =
      revisionIds.length === 0
        ? []
        : await this.database.module.findMany({
            where: { revisionId: { in: revisionIds }, deletedAt: null },
            select: { ...moduleSelect, revisionId: true },
          });
    const detail = toStudentDetail(
      user,
      enrollments.map(({ courseRevisionId, ...row }) => ({
        ...row,
        revisionModules: modules.filter((module) => module.revisionId === courseRevisionId),
      })),
      this.config.publicAppUrl,
      this.clock.now(),
    );
    if (detail === null) throw new ApiException(404, "NOT_FOUND");
    return detail;
  }
}
