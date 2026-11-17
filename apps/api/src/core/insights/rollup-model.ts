export const rollupKinds = ["ENROLLMENT", "MODULE", "QUIZ", "QUESTION"] as const;

export type RollupKind = (typeof rollupKinds)[number];

export const rollupMetrics = [
  "registered",
  "verified",
  "approved",
  "started",
  "quizReady",
  "completed",
  "attempts",
  "passedAttempts",
  "attemptedStudents",
  "passedStudents",
  "answered",
  "missed",
  "askedStudents",
] as const;

export type RollupMetric = (typeof rollupMetrics)[number];

export type RollupMetrics = Record<RollupMetric, number>;

export interface GroupDimensions {
  courseId: string;
  universityId: string;
  facultyId: string;
  departmentId: string;
  session: string;
}

export interface RollupSubject extends GroupDimensions {
  kind: RollupKind;
  moduleId: string | null;
  questionId: string | null;
}

export interface RollupEvent extends RollupSubject {
  metric: RollupMetric;
  amount: number;
}

export interface RollupRow extends RollupSubject {
  key: string;
  metrics: RollupMetrics;
}

export const emptyMetrics = (): RollupMetrics => ({
  registered: 0,
  verified: 0,
  approved: 0,
  started: 0,
  quizReady: 0,
  completed: 0,
  attempts: 0,
  passedAttempts: 0,
  attemptedStudents: 0,
  passedStudents: 0,
  answered: 0,
  missed: 0,
  askedStudents: 0,
});

export const rollupKey = (subject: RollupSubject): string =>
  [
    subject.kind,
    subject.courseId,
    subject.moduleId ?? "",
    subject.questionId ?? "",
    subject.departmentId,
    subject.session,
  ].join("|");

export class RollupAccumulator {
  private readonly rows = new Map<string, RollupRow>();

  add(event: RollupEvent): void {
    const key = rollupKey(event);
    let row = this.rows.get(key);
    if (row === undefined) {
      row = {
        key,
        kind: event.kind,
        courseId: event.courseId,
        moduleId: event.moduleId,
        questionId: event.questionId,
        universityId: event.universityId,
        facultyId: event.facultyId,
        departmentId: event.departmentId,
        session: event.session,
        metrics: emptyMetrics(),
      };
      this.rows.set(key, row);
    }
    row.metrics[event.metric] += event.amount;
  }

  addAll(events: readonly RollupEvent[]): void {
    for (const event of events) this.add(event);
  }

  result(): RollupRow[] {
    return [...this.rows.values()]
      .filter((row) => rollupMetrics.some((metric) => row.metrics[metric] !== 0))
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  }
}
