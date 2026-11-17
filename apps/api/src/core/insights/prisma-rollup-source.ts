import type { HeatClient, Prisma } from "@heat/db";
import type { DayWindow } from "./dhaka-day";
import type { RollupSource } from "./insight-ports";
import type { GroupDimensions, RollupEvent, RollupMetric, RollupSubject } from "./rollup-model";

const batchSize = 500;
const lookupChunk = 500;

const profileSelect = {
  select: {
    session: true,
    departmentId: true,
    department: { select: { universityId: true, facultyId: true } },
  },
} as const;

const enrollmentSelect = {
  select: { courseId: true, user: { select: { profile: profileSelect } } },
} as const;

const liveEnrollment: Prisma.EnrollmentWhereInput = {
  deletedAt: null,
  user: { deletedAt: null, profile: { deletedAt: null } },
};

interface EnrollmentShape {
  courseId: string;
  user: {
    profile: {
      session: string;
      departmentId: string;
      department: { universityId: string; facultyId: string };
    } | null;
  };
}

const dimensionsOf = (enrollment: EnrollmentShape): GroupDimensions | null => {
  const profile = enrollment.user.profile;
  if (profile === null) return null;
  return {
    courseId: enrollment.courseId,
    universityId: profile.department.universityId,
    facultyId: profile.department.facultyId,
    departmentId: profile.departmentId,
    session: profile.session,
  };
};

const subject = (
  kind: RollupSubject["kind"],
  dimensions: GroupDimensions,
  moduleId: string | null,
  questionId: string | null,
): RollupSubject => ({ kind, moduleId, questionId, ...dimensions });

const chunked = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const within = (window: DayWindow) => ({ gte: window.start, lt: window.end });

type Emit = (events: RollupEvent[]) => void;

const enrollmentStages = [
  ["registered", "requestedAt"],
  ["verified", "verifiedAt"],
  ["approved", "approvedAt"],
  ["completed", "completedAt"],
] as const satisfies readonly (readonly [RollupMetric, keyof Prisma.EnrollmentWhereInput])[];

const moduleStages = [
  ["started", "startedAt"],
  ["quizReady", "quizReadyAt"],
  ["completed", "completedAt"],
] as const satisfies readonly (readonly [RollupMetric, keyof Prisma.ModuleProgressWhereInput])[];

export class PrismaRollupSource implements RollupSource {
  constructor(private readonly database: HeatClient) {}

  async readDay(window: DayWindow, emit: Emit): Promise<void> {
    await this.readEnrollmentStages(window, emit);
    await this.readFirstStarts(window, emit);
    await this.readModuleProgress(window, emit);
    await this.readQuizAttempts(window, emit);
  }

  private async readEnrollmentStages(window: DayWindow, emit: Emit): Promise<void> {
    for (const [metric, field] of enrollmentStages) {
      let cursor: string | undefined;
      for (;;) {
        const rows = await this.database.enrollment.findMany({
          where: { ...liveEnrollment, [field]: within(window) },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
          select: { id: true, courseId: true, user: enrollmentSelect.select.user },
        });
        const events: RollupEvent[] = [];
        for (const row of rows) {
          const dimensions = dimensionsOf(row);
          if (dimensions === null) continue;
          events.push({
            ...subject("ENROLLMENT", dimensions, null, null),
            metric,
            amount: 1,
          });
        }
        emit(events);
        const last = rows.at(-1);
        if (last === undefined || rows.length < batchSize) break;
        cursor = last.id;
      }
    }
  }

  private async readFirstStarts(window: DayWindow, emit: Emit): Promise<void> {
    const candidates = new Map<string, GroupDimensions>();
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.database.moduleProgress.findMany({
        where: { startedAt: within(window), enrollment: liveEnrollment },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
        select: { id: true, enrollmentId: true, enrollment: enrollmentSelect },
      });
      for (const row of rows) {
        const dimensions = dimensionsOf(row.enrollment);
        if (dimensions !== null) candidates.set(row.enrollmentId, dimensions);
      }
      const last = rows.at(-1);
      if (last === undefined || rows.length < batchSize) break;
      cursor = last.id;
    }
    for (const ids of chunked([...candidates.keys()], lookupChunk)) {
      const earliest = await this.database.moduleProgress.groupBy({
        by: ["enrollmentId"],
        where: { enrollmentId: { in: ids } },
        _min: { startedAt: true },
      });
      const events: RollupEvent[] = [];
      for (const entry of earliest) {
        const first = entry._min.startedAt;
        const dimensions = candidates.get(entry.enrollmentId);
        if (first === null || dimensions === undefined) continue;
        if (first < window.start || first >= window.end) continue;
        events.push({
          ...subject("ENROLLMENT", dimensions, null, null),
          metric: "started",
          amount: 1,
        });
      }
      emit(events);
    }
  }

  private async readModuleProgress(window: DayWindow, emit: Emit): Promise<void> {
    for (const [metric, field] of moduleStages) {
      let cursor: string | undefined;
      for (;;) {
        const rows = await this.database.moduleProgress.findMany({
          where: { [field]: within(window), enrollment: liveEnrollment },
          orderBy: { id: "asc" },
          take: batchSize,
          ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
          select: { id: true, moduleId: true, enrollment: enrollmentSelect },
        });
        const events: RollupEvent[] = [];
        for (const row of rows) {
          const dimensions = dimensionsOf(row.enrollment);
          if (dimensions === null) continue;
          events.push({
            ...subject("MODULE", dimensions, row.moduleId, null),
            metric,
            amount: 1,
          });
        }
        emit(events);
        const last = rows.at(-1);
        if (last === undefined || rows.length < batchSize) break;
        cursor = last.id;
      }
    }
  }

  private async readQuizAttempts(window: DayWindow, emit: Emit): Promise<void> {
    const attemptedToday = new Set<string>();
    const passedToday = new Set<string>();
    let cursor: string | undefined;
    for (;;) {
      const attempts = await this.database.quizAttempt.findMany({
        where: { submittedAt: within(window), enrollment: liveEnrollment },
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        take: batchSize,
        ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
        select: {
          id: true,
          enrollmentId: true,
          quizId: true,
          passed: true,
          quiz: { select: { moduleId: true } },
          enrollment: enrollmentSelect,
        },
      });
      const pairs = attempts.map((attempt) => ({
        enrollmentId: attempt.enrollmentId,
        quizId: attempt.quizId,
      }));
      const earlierAttempts = await this.pairsBefore(pairs, window.start, false);
      const earlierPasses = await this.pairsBefore(pairs, window.start, true);
      const firstAttemptIds = new Set<string>();
      const subjects = new Map<string, { dimensions: GroupDimensions; moduleId: string }>();
      const events: RollupEvent[] = [];
      for (const attempt of attempts) {
        const dimensions = dimensionsOf(attempt.enrollment);
        if (dimensions === null) continue;
        const moduleId = attempt.quiz.moduleId;
        subjects.set(attempt.id, { dimensions, moduleId });
        const pair = `${attempt.enrollmentId}|${attempt.quizId}`;
        const quizSubject = subject("QUIZ", dimensions, moduleId, null);
        events.push({ ...quizSubject, metric: "attempts", amount: 1 });
        if (attempt.passed === true)
          events.push({ ...quizSubject, metric: "passedAttempts", amount: 1 });
        if (!earlierAttempts.has(pair) && !attemptedToday.has(pair)) {
          attemptedToday.add(pair);
          firstAttemptIds.add(attempt.id);
          events.push({ ...quizSubject, metric: "attemptedStudents", amount: 1 });
        }
        if (attempt.passed === true && !earlierPasses.has(pair) && !passedToday.has(pair)) {
          passedToday.add(pair);
          events.push({ ...quizSubject, metric: "passedStudents", amount: 1 });
        }
      }
      emit(events);
      await this.readAnswers(
        attempts.map((attempt) => attempt.id),
        subjects,
        firstAttemptIds,
        emit,
      );
      const last = attempts.at(-1);
      if (last === undefined || attempts.length < batchSize) break;
      cursor = last.id;
    }
  }

  private async pairsBefore(
    pairs: readonly { enrollmentId: string; quizId: string }[],
    before: Date,
    passedOnly: boolean,
  ): Promise<Set<string>> {
    const found = new Set<string>();
    const enrollmentIds = [...new Set(pairs.map((pair) => pair.enrollmentId))];
    for (const ids of chunked(enrollmentIds, lookupChunk)) {
      const rows = await this.database.quizAttempt.groupBy({
        by: ["enrollmentId", "quizId"],
        where: {
          enrollmentId: { in: ids },
          submittedAt: { lt: before },
          ...(passedOnly ? { passed: true } : {}),
        },
      });
      for (const row of rows) found.add(`${row.enrollmentId}|${row.quizId}`);
    }
    return found;
  }

  private async readAnswers(
    attemptIds: readonly string[],
    subjects: ReadonlyMap<string, { dimensions: GroupDimensions; moduleId: string }>,
    firstAttemptIds: ReadonlySet<string>,
    emit: Emit,
  ): Promise<void> {
    for (const ids of chunked(attemptIds, 200)) {
      const answers = await this.database.answer.findMany({
        where: { attemptId: { in: ids } },
        select: {
          attemptId: true,
          questionId: true,
          option: { select: { isCorrect: true } },
        },
      });
      const events: RollupEvent[] = [];
      for (const answer of answers) {
        const owner = subjects.get(answer.attemptId);
        if (owner === undefined) continue;
        const questionSubject = subject(
          "QUESTION",
          owner.dimensions,
          owner.moduleId,
          answer.questionId,
        );
        events.push({ ...questionSubject, metric: "answered", amount: 1 });
        if (!answer.option.isCorrect)
          events.push({ ...questionSubject, metric: "missed", amount: 1 });
        if (firstAttemptIds.has(answer.attemptId)) {
          events.push({ ...questionSubject, metric: "askedStudents", amount: 1 });
        }
      }
      emit(events);
    }
  }
}
