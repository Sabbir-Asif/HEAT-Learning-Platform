import { videoCompletionThreshold } from "@heat/contracts";
import type { StudentDetail } from "@heat/contracts";
import { canGrantAttempt } from "./attempt-grant-rules";
import { certificateStatusOf, verificationUrlOf } from "../certificates/certificate-rules";

export const coveragePercent = (coverage: number): number =>
  Math.min(100, Math.max(0, Math.round(coverage * 100)));

export const meetsVideoThreshold = (facts: {
  coverage: number;
  completedAt: Date | null;
}): boolean => facts.completedAt !== null || facts.coverage >= videoCompletionThreshold;

export interface StudentDetailUserRow {
  id: string;
  email: string;
  profile: {
    name: string;
    session: string;
    department: {
      id: string;
      name: string;
      universityFaculty: {
        university: { id: string; name: string };
        faculty: { id: string; name: string };
      };
    };
  } | null;
}

export interface StudentDetailEnrollmentRow {
  id: string;
  status: StudentDetail["enrollments"][number]["status"];
  requestedAt: Date;
  approvedAt: Date | null;
  completedAt: Date | null;
  course: { id: string; title: string };
  decisions: {
    id: string;
    action: StudentDetail["enrollments"][number]["decisions"][number]["action"];
    reason: string | null;
    decidedAt: Date;
    admin: { id: string; email: string };
  }[];
  certificate: {
    id: string;
    number: string;
    fileKey: string | null;
    revokedAt: Date | null;
    issuedAt: Date;
  } | null;
  videoProgress: { videoId: string; coverage: number; completedAt: Date | null }[];
  moduleProgress: {
    moduleId: string;
    status: StudentDetail["enrollments"][number]["modules"][number]["status"];
    completedAt: Date | null;
  }[];
  quizAttempts: {
    id: string;
    quizId: string;
    startedAt: Date;
    submittedAt: Date | null;
    scorePercent: number | null;
    passMarkSnapshot: number;
    passed: boolean | null;
  }[];
  attemptGrants: { quizId: string; extraAttempts: number }[];
  revisionModules: {
    id: string;
    order: number;
    title: string;
    videos: { id: string; order: number; title: string; required: boolean }[];
    quiz: { id: string; attemptLimit: number | null; waitMinutes: number } | null;
  }[];
}

const iso = (value: Date | null): string | null => (value === null ? null : value.toISOString());

const toEnrollment = (
  row: StudentDetailEnrollmentRow,
  publicAppUrl: string,
  now: Date,
): StudentDetail["enrollments"][number] => {
  const coverageByVideo = new Map(row.videoProgress.map((entry) => [entry.videoId, entry]));
  const progressByModule = new Map(row.moduleProgress.map((entry) => [entry.moduleId, entry]));
  return {
    id: row.id,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    approvedAt: iso(row.approvedAt),
    completedAt: iso(row.completedAt),
    course: row.course,
    decisions: [...row.decisions]
      .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime())
      .map((decision) => ({
        id: decision.id,
        action: decision.action,
        reason: decision.reason,
        decidedAt: decision.decidedAt.toISOString(),
        admin: decision.admin,
      })),
    modules: [...row.revisionModules]
      .sort((a, b) => a.order - b.order)
      .map((module) => {
        const progress = progressByModule.get(module.id);
        const quiz = module.quiz;
        const quizAttempts =
          quiz === null ? [] : row.quizAttempts.filter((attempt) => attempt.quizId === quiz.id);
        const grantedAttempts =
          quiz === null
            ? 0
            : row.attemptGrants
                .filter((grant) => grant.quizId === quiz.id)
                .reduce((sum, grant) => sum + grant.extraAttempts, 0);
        return {
          moduleId: module.id,
          order: module.order,
          title: module.title,
          status: progress?.status ?? "LOCKED",
          completedAt: iso(progress?.completedAt ?? null),
          videos: [...module.videos]
            .sort((a, b) => a.order - b.order)
            .map((video) => {
              const watched = coverageByVideo.get(video.id) ?? { coverage: 0, completedAt: null };
              return {
                videoId: video.id,
                title: video.title,
                required: video.required,
                coveragePercent: coveragePercent(watched.coverage),
                meetsThreshold: meetsVideoThreshold(watched),
              };
            }),
          quiz:
            quiz === null
              ? null
              : {
                  id: quiz.id,
                  attemptLimit: quiz.attemptLimit,
                  grantedAttempts,
                  canGrantAttempt: canGrantAttempt(
                    {
                      enrollmentStatus: row.status,
                      attemptLimit: quiz.attemptLimit,
                      waitMinutes: quiz.waitMinutes,
                      extraAttempts: grantedAttempts,
                      attempts: quizAttempts.flatMap((attempt) =>
                        attempt.submittedAt === null
                          ? []
                          : [{ passed: attempt.passed, submittedAt: attempt.submittedAt }],
                      ),
                    },
                    now,
                  ),
                },
          quizAttempts: [...quizAttempts]
            .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
            .map((attempt) => ({
              id: attempt.id,
              startedAt: attempt.startedAt.toISOString(),
              submittedAt: iso(attempt.submittedAt),
              scorePercent: attempt.scorePercent,
              passMarkSnapshot: attempt.passMarkSnapshot,
              passed: attempt.passed === true,
            })),
        };
      }),
    certificate:
      row.certificate === null
        ? null
        : {
            id: row.certificate.id,
            number: row.certificate.number,
            status: certificateStatusOf(row.certificate),
            issuedAt: row.certificate.issuedAt.toISOString(),
            verificationUrl: verificationUrlOf(publicAppUrl, row.certificate.number),
          },
  };
};

export const toStudentDetail = (
  user: StudentDetailUserRow,
  enrollments: readonly StudentDetailEnrollmentRow[],
  publicAppUrl: string,
  now: Date,
): StudentDetail | null => {
  if (user.profile === null) return null;
  const { university, faculty } = user.profile.department.universityFaculty;
  return {
    userId: user.id,
    name: user.profile.name,
    email: user.email,
    session: user.profile.session,
    university,
    faculty,
    department: { id: user.profile.department.id, name: user.profile.department.name },
    enrollments: enrollments.map((row) => toEnrollment(row, publicAppUrl, now)),
  };
};
