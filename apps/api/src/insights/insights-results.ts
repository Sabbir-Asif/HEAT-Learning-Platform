import { insightSuppressionThreshold } from "@heat/contracts";
import type {
  InsightMissedQuestionRow,
  InsightModuleResultRow,
  InsightQuizResultRow,
} from "@heat/contracts";
import type { GroupTotals } from "./insights-query";

export interface ModuleInfo {
  id: string;
  order: number;
  title: string;
  deleted: boolean;
  revisionId: string;
  revisionNumber: number;
  courseId: string;
  courseTitle: string;
}

export interface QuestionInfo {
  id: string;
  order: number;
  text: string;
}

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const isSmallCell = (value: number, threshold: number): boolean => value > 0 && value < threshold;

const compareModules = (a: ModuleInfo, b: ModuleInfo): number =>
  a.courseTitle.localeCompare(b.courseTitle) ||
  a.courseId.localeCompare(b.courseId) ||
  a.revisionNumber - b.revisionNumber ||
  a.order - b.order;

export const moduleLabels = (
  infos: readonly ModuleInfo[],
  shown: ReadonlySet<string>,
): Map<string, string> => {
  const visible = infos.filter((info) => shown.has(info.id));
  const courses = new Set(visible.map((info) => info.courseId));
  const revisionsByCourse = new Map<string, Set<string>>();
  for (const info of visible) {
    const revisions = revisionsByCourse.get(info.courseId) ?? new Set<string>();
    revisions.add(info.revisionId);
    revisionsByCourse.set(info.courseId, revisions);
  }
  return new Map(
    visible.map((info) => {
      const course = courses.size > 1 ? `${info.courseTitle} · ` : "";
      const revision =
        (revisionsByCourse.get(info.courseId)?.size ?? 0) > 1
          ? `Revision ${info.revisionNumber} · `
          : "";
      return [info.id, `${course}${revision}${info.title}`];
    }),
  );
};

const orderedByModule = <T extends { moduleId: string }>(
  rows: readonly T[],
  infos: ReadonlyMap<string, ModuleInfo>,
): T[] =>
  [...rows].sort((a, b) => {
    const left = infos.get(a.moduleId);
    const right = infos.get(b.moduleId);
    if (left === undefined || right === undefined) {
      return left === right ? a.moduleId.localeCompare(b.moduleId) : left === undefined ? 1 : -1;
    }
    return compareModules(left, right);
  });

export const toModuleResults = (
  totals: readonly GroupTotals[],
  infos: readonly ModuleInfo[],
  threshold: number = insightSuppressionThreshold,
): InsightModuleResultRow[] => {
  const byId = new Map(infos.map((info) => [info.id, info]));
  const totalsById = new Map(totals.map((group) => [group.key, group.totals]));
  const labels = moduleLabels(infos, new Set(totals.map((group) => group.key)));
  const nextInRevision = (info: ModuleInfo): ModuleInfo | undefined =>
    infos
      .filter(
        (other) =>
          other.revisionId === info.revisionId && !other.deleted && other.order > info.order,
      )
      .sort((a, b) => a.order - b.order)[0];
  const rows = totals
    .filter((group) => group.key !== "")
    .map((group): InsightModuleResultRow => {
      const label = labels.get(group.key) ?? group.key;
      const { started, quizReady, completed } = group.totals;
      const students = Math.max(started, quizReady, completed);
      if (students < threshold) {
        return {
          moduleId: group.key,
          label,
          suppressed: true,
          students: null,
          started: null,
          quizReady: null,
          completed: null,
          completionRate: null,
          dropOff: null,
        };
      }
      const info = byId.get(group.key);
      const next = info === undefined ? undefined : nextInRevision(info);
      let dropOff: number | null;
      if (info === undefined) dropOff = null;
      else if (next === undefined) dropOff = Math.max(0, started - completed);
      else {
        const nextStarted = totalsById.get(next.id)?.started ?? 0;
        dropOff = isSmallCell(nextStarted, threshold) ? null : Math.max(0, started - nextStarted);
      }
      return {
        moduleId: group.key,
        label,
        suppressed: false,
        students,
        started,
        quizReady,
        completed,
        completionRate: started > 0 ? Math.min(100, round((completed / started) * 100, 1)) : null,
        dropOff,
      };
    });
  return orderedByModule(rows, byId);
};

export const toQuizResults = (
  totals: readonly GroupTotals[],
  infos: readonly ModuleInfo[],
  quizIdByModule: ReadonlyMap<string, string>,
  threshold: number = insightSuppressionThreshold,
): InsightQuizResultRow[] => {
  const byId = new Map(infos.map((info) => [info.id, info]));
  const labels = moduleLabels(infos, new Set(totals.map((group) => group.key)));
  const rows = totals
    .filter((group) => group.key !== "" && quizIdByModule.has(group.key))
    .map((group): InsightQuizResultRow => {
      const label = labels.get(group.key) ?? group.key;
      const quizId = quizIdByModule.get(group.key) ?? "";
      const { attemptedStudents, passedStudents, attempts } = group.totals;
      if (attemptedStudents < threshold) {
        return {
          quizId,
          moduleId: group.key,
          label,
          suppressed: true,
          attemptedStudents: null,
          passedStudents: null,
          attempts: null,
          passRate: null,
          averageAttempts: null,
        };
      }
      return {
        quizId,
        moduleId: group.key,
        label,
        suppressed: false,
        attemptedStudents,
        passedStudents,
        attempts,
        passRate: Math.min(100, round((passedStudents / attemptedStudents) * 100, 1)),
        averageAttempts: round(attempts / attemptedStudents, 2),
      };
    });
  return orderedByModule(rows, byId);
};

export interface MissedQuestionsResult {
  rows: InsightMissedQuestionRow[];
  suppressedCount: number;
}

export const toMissedQuestions = (
  totals: readonly GroupTotals[],
  questions: readonly QuestionInfo[],
  limit: number,
  threshold: number = insightSuppressionThreshold,
): MissedQuestionsResult => {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const rows: InsightMissedQuestionRow[] = [];
  let suppressedCount = 0;
  for (const group of totals) {
    const question = byId.get(group.key);
    if (question === undefined) continue;
    const { askedStudents, answered, missed } = group.totals;
    if (askedStudents < threshold) {
      suppressedCount += 1;
      continue;
    }
    rows.push({
      questionId: question.id,
      order: question.order,
      text: question.text,
      answered,
      missed,
      missPercent: answered > 0 ? round((missed / answered) * 100, 1) : 0,
    });
  }
  rows.sort(
    (a, b) => b.missPercent - a.missPercent || b.answered - a.answered || a.order - b.order,
  );
  return { rows: rows.slice(0, limit), suppressedCount };
};
