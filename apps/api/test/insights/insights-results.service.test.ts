import { describe, expect, test, vi } from "vitest";
import { emptyMetrics } from "../../src/core";
import { InsightsQueryService } from "../../src/insights/insights-query.service";

const rollupRow = (overrides: Record<string, unknown>) => ({
  id: "id",
  day: new Date("2026-11-13T00:00:00.000Z"),
  kind: "MODULE",
  key: "k",
  courseId: "course-1",
  moduleId: "m1",
  questionId: null,
  universityId: "uni-1",
  facultyId: "fac-1",
  departmentId: "dept-1",
  session: "2020-21",
  ...emptyMetrics(),
  ...overrides,
});

const moduleRow = (id: string, order: number, revisionId: string, number: number) => ({
  id,
  order,
  title: `Module ${order}`,
  deletedAt: null,
  revisionId,
  revision: { number, courseId: "course-1", course: { title: "Safety" } },
});

const build = (rows: unknown[]) => {
  const findMany = vi.fn().mockResolvedValue(rows);
  const database = {
    insightRollup: { findMany },
    insightRun: { findFirst: vi.fn().mockResolvedValue(null) },
    module: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          moduleRow("m1", 1, "rev-1", 1),
          moduleRow("m2", 2, "rev-1", 1),
          moduleRow("m9", 1, "rev-2", 2),
        ]),
    },
    quiz: {
      findMany: vi.fn().mockResolvedValue([
        { id: "q1", moduleId: "m1" },
        { id: "q9", moduleId: "m9" },
      ]),
      findUnique: vi.fn().mockResolvedValue({ id: "q1", moduleId: "m1" }),
    },
    question: {
      findMany: vi.fn().mockResolvedValue([
        { id: "a", order: 1, text: "Is consent reversible?" },
        { id: "b", order: 2, text: "Who may report?" },
      ]),
    },
    $includingDeleted: () => database,
  };
  return { service: new InsightsQueryService(database as never), findMany, database };
};

describe("InsightsQueryService module and quiz results", () => {
  test("module results read the module rollups and keep two revisions apart", async () => {
    const { service, findMany } = build([
      rollupRow({ id: "1", moduleId: "m1", started: 20, completed: 15 }),
      rollupRow({ id: "2", moduleId: "m2", started: 12, completed: 9 }),
      rollupRow({ id: "3", moduleId: "m9", started: 7, completed: 7 }),
    ]);
    const result = await service.moduleResults({ courseId: "course-1" });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      kind: "MODULE",
      courseId: "course-1",
    });
    expect(
      result.rows.map((row) => [row.label, row.started, row.completionRate, row.dropOff]),
    ).toEqual([
      ["Revision 1 · Module 1", 20, 75, 8],
      ["Revision 1 · Module 2", 12, 75, 3],
      ["Revision 2 · Module 1", 7, 100, 0],
    ]);
    expect(result.suppressionThreshold).toBe(5);
  });

  test("module results with no rollup rows are empty", async () => {
    const { service } = build([]);
    expect((await service.moduleResults({})).rows).toEqual([]);
  });

  test("quiz results carry the quiz id, pass rate and average attempts", async () => {
    const { service, findMany } = build([
      rollupRow({
        id: "1",
        kind: "QUIZ",
        moduleId: "m1",
        attemptedStudents: 10,
        passedStudents: 8,
        attempts: 25,
      }),
      rollupRow({ id: "2", kind: "QUIZ", moduleId: "m9", attemptedStudents: 3, attempts: 5 }),
    ]);
    const result = await service.quizResults({});
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ kind: "QUIZ" });
    expect(result.rows[0]).toMatchObject({
      quizId: "q1",
      passRate: 80,
      averageAttempts: 2.5,
      suppressed: false,
    });
    expect(result.rows[1]).toMatchObject({ quizId: "q9", suppressed: true, passRate: null });
  });

  test("missed questions are limited to the quiz module and ranked", async () => {
    const { service, findMany } = build([
      rollupRow({
        id: "1",
        kind: "QUESTION",
        questionId: "a",
        askedStudents: 10,
        answered: 10,
        missed: 3,
      }),
      rollupRow({
        id: "2",
        kind: "QUESTION",
        questionId: "b",
        askedStudents: 10,
        answered: 10,
        missed: 6,
      }),
    ]);
    const result = await service.missedQuestions({ quizId: "q1", limit: 1 });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      kind: "QUESTION",
      moduleId: "m1",
    });
    expect(result.label).toBe("Module 1");
    expect(result.rows).toEqual([
      {
        questionId: "b",
        order: 2,
        text: "Who may report?",
        answered: 10,
        missed: 6,
        missPercent: 60,
      },
    ]);
  });

  test("an unknown quiz is not found", async () => {
    const { service, database } = build([]);
    database.quiz.findUnique.mockResolvedValue(null);
    await expect(service.missedQuestions({ quizId: "nope" })).rejects.toMatchObject({
      status: 404,
    });
  });
});
