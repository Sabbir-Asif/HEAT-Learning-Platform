import { describe, expect, test } from "vitest";
import { emptyMetrics } from "../../src/core";
import type { RollupMetrics } from "../../src/core";
import {
  moduleLabels,
  toMissedQuestions,
  toModuleResults,
  toQuizResults,
} from "../../src/insights/insights-results";
import type { ModuleInfo } from "../../src/insights/insights-results";

const totals = (key: string, metrics: Partial<RollupMetrics>) => ({
  key,
  totals: { ...emptyMetrics(), ...metrics },
});

const info = (id: string, order: number, overrides: Partial<ModuleInfo> = {}): ModuleInfo => ({
  id,
  order,
  title: `Module ${order}`,
  deleted: false,
  revisionId: "rev-1",
  revisionNumber: 1,
  courseId: "course-1",
  courseTitle: "Safety",
  ...overrides,
});

const sequence = [info("m1", 1), info("m2", 2), info("m3", 3)];

describe("toModuleResults", () => {
  test("computes completion rate and drop-off from the last module reached", () => {
    const rows = toModuleResults(
      [
        totals("m1", { started: 20, quizReady: 18, completed: 16 }),
        totals("m2", { started: 14, quizReady: 12, completed: 10 }),
        totals("m3", { started: 8, quizReady: 7, completed: 6 }),
      ],
      sequence,
    );
    expect(rows.map((row) => [row.label, row.completionRate, row.dropOff])).toEqual([
      ["Module 1", 80, 6],
      ["Module 2", 71.4, 6],
      ["Module 3", 75, 2],
    ]);
    expect(rows[0]).toMatchObject({ students: 20, started: 20, quizReady: 18, completed: 16 });
  });

  test("withholds a group under the threshold with every value blank", () => {
    const [row] = toModuleResults([totals("m1", { started: 4, completed: 2 })], sequence);
    expect(row).toMatchObject({
      suppressed: true,
      students: null,
      started: null,
      completed: null,
      completionRate: null,
      dropOff: null,
    });
  });

  test("hides the drop-off when the next module has a small non-zero start count", () => {
    const rows = toModuleResults(
      [totals("m1", { started: 10, completed: 9 }), totals("m2", { started: 3 })],
      sequence,
    );
    expect(rows[0]?.dropOff).toBeNull();
    expect(rows[1]?.suppressed).toBe(true);
  });

  test("a next module nobody started counts every starter as dropped off", () => {
    const [row] = toModuleResults([totals("m1", { started: 10, completed: 9 })], sequence);
    expect(row?.dropOff).toBe(10);
  });

  test("keeps the completion rate at or under 100", () => {
    const [row] = toModuleResults([totals("m3", { started: 6, completed: 9 })], sequence);
    expect(row?.completionRate).toBe(100);
  });

  test("separates two revisions of one course and labels them", () => {
    const infos = [
      info("a1", 1, { revisionId: "rev-1", revisionNumber: 1, title: "Consent" }),
      info("b1", 1, { revisionId: "rev-2", revisionNumber: 2, title: "Consent" }),
    ];
    const rows = toModuleResults(
      [totals("b1", { started: 7, completed: 5 }), totals("a1", { started: 30, completed: 25 })],
      infos,
    );
    expect(rows.map((row) => [row.moduleId, row.label, row.started])).toEqual([
      ["a1", "Revision 1 · Consent", 30],
      ["b1", "Revision 2 · Consent", 7],
    ]);
    expect(rows.map((row) => row.dropOff)).toEqual([5, 2]);
  });

  test("a deleted next module is skipped when finding drop-off", () => {
    const infos = [info("m1", 1), info("m2", 2, { deleted: true }), info("m3", 3)];
    const rows = toModuleResults(
      [totals("m1", { started: 12, completed: 11 }), totals("m3", { started: 9 })],
      infos,
    );
    expect(rows[0]?.dropOff).toBe(3);
  });
});

describe("moduleLabels", () => {
  test("adds the course title only when several courses are shown", () => {
    const infos = [
      info("m1", 1),
      info("x1", 1, { courseId: "course-2", courseTitle: "Respect", revisionId: "rev-9" }),
    ];
    const labels = moduleLabels(infos, new Set(["m1", "x1"]));
    expect(labels.get("m1")).toBe("Safety · Module 1");
    expect(labels.get("x1")).toBe("Respect · Module 1");
  });
});

describe("toQuizResults", () => {
  const quizzes = new Map([
    ["m1", "q1"],
    ["m2", "q2"],
  ]);

  test("computes pass rate and average attempts per student", () => {
    const [row] = toQuizResults(
      [totals("m1", { attemptedStudents: 12, passedStudents: 9, attempts: 30, passedAttempts: 9 })],
      sequence,
      quizzes,
    );
    expect(row).toMatchObject({
      quizId: "q1",
      moduleId: "m1",
      suppressed: false,
      attemptedStudents: 12,
      passedStudents: 9,
      attempts: 30,
      passRate: 75,
      averageAttempts: 2.5,
    });
  });

  test("withholds a quiz taken by fewer than five students", () => {
    const [row] = toQuizResults(
      [totals("m2", { attemptedStudents: 4, passedStudents: 4, attempts: 4 })],
      sequence,
      quizzes,
    );
    expect(row).toMatchObject({
      suppressed: true,
      passRate: null,
      averageAttempts: null,
      attempts: null,
    });
  });

  test("keeps quizzes of two revisions apart", () => {
    const infos = [
      info("m1", 1, { revisionId: "rev-1", revisionNumber: 1 }),
      info("m9", 1, { revisionId: "rev-2", revisionNumber: 2 }),
    ];
    const rows = toQuizResults(
      [
        totals("m9", { attemptedStudents: 6, passedStudents: 3, attempts: 9 }),
        totals("m1", { attemptedStudents: 10, passedStudents: 10, attempts: 10 }),
      ],
      infos,
      new Map([
        ["m1", "q1"],
        ["m9", "q9"],
      ]),
    );
    expect(rows.map((row) => [row.quizId, row.label, row.passRate])).toEqual([
      ["q1", "Revision 1 · Module 1", 100],
      ["q9", "Revision 2 · Module 1", 50],
    ]);
  });
});

describe("toMissedQuestions", () => {
  const questions = [
    { id: "a", order: 1, text: "First" },
    { id: "b", order: 2, text: "Second" },
    { id: "c", order: 3, text: "Third" },
    { id: "d", order: 4, text: "Fourth" },
  ];

  test("ranks by miss rate, then answers, then order, and limits the list", () => {
    const result = toMissedQuestions(
      [
        totals("a", { askedStudents: 10, answered: 20, missed: 5 }),
        totals("b", { askedStudents: 10, answered: 20, missed: 10 }),
        totals("c", { askedStudents: 10, answered: 40, missed: 20 }),
        totals("d", { askedStudents: 10, answered: 10, missed: 1 }),
      ],
      questions,
      3,
    );
    expect(result.rows.map((row) => [row.questionId, row.missPercent, row.answered])).toEqual([
      ["c", 50, 40],
      ["b", 50, 20],
      ["a", 25, 20],
    ]);
    expect(result.suppressedCount).toBe(0);
  });

  test("leaves out questions seen by fewer than five students and counts them", () => {
    const result = toMissedQuestions(
      [
        totals("a", { askedStudents: 4, answered: 4, missed: 4 }),
        totals("b", { askedStudents: 6, answered: 8, missed: 2 }),
      ],
      questions,
      10,
    );
    expect(result.rows.map((row) => row.questionId)).toEqual(["b"]);
    expect(result.suppressedCount).toBe(1);
  });

  test("carries the question text, the miss percentage and the answers it rests on", () => {
    const [row] = toMissedQuestions(
      [totals("a", { askedStudents: 9, answered: 12, missed: 5 })],
      questions,
      10,
    ).rows;
    expect(row).toEqual({
      questionId: "a",
      order: 1,
      text: "First",
      answered: 12,
      missed: 5,
      missPercent: 41.7,
    });
  });
});
