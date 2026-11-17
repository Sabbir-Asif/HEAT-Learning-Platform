import { describe, expect, test } from "vitest";
import { emptyMetrics } from "../../src/core";
import type { RollupMetrics } from "../../src/core";
import {
  GroupAccumulator,
  buildRollupWhere,
  groupKeyOf,
  isGroupByAllowed,
  studentsIn,
  toCsv,
  toInsightGroup,
} from "../../src/insights/insights-query";
import type { QueryRow } from "../../src/insights/insights-query";

const metrics = (values: Partial<RollupMetrics>): RollupMetrics => ({
  ...emptyMetrics(),
  ...values,
});

const row = (overrides: Partial<QueryRow> = {}): QueryRow => ({
  day: "2026-11-13",
  courseId: "course-1",
  moduleId: null,
  questionId: null,
  universityId: "uni-1",
  facultyId: "fac-1",
  departmentId: "dept-1",
  session: "2020-21",
  metrics: metrics({ registered: 1 }),
  ...overrides,
});

describe("buildRollupWhere", () => {
  test("filters only on the series kind when no filter is given", () => {
    expect(buildRollupWhere("enrollments", {})).toEqual({ kind: "ENROLLMENT" });
    expect(buildRollupWhere("modules", {})).toEqual({ kind: "MODULE" });
    expect(buildRollupWhere("quizzes", {})).toEqual({ kind: "QUIZ" });
    expect(buildRollupWhere("questions", {})).toEqual({ kind: "QUESTION" });
  });

  test("combines every shared filter", () => {
    expect(
      buildRollupWhere("enrollments", {
        from: "2026-11-01",
        to: "2026-11-10",
        courseId: "c",
        universityId: "u",
        facultyId: "f",
        departmentId: "d",
        session: "2020-21",
      }),
    ).toEqual({
      kind: "ENROLLMENT",
      day: { gte: new Date("2026-11-01T00:00:00.000Z"), lte: new Date("2026-11-10T00:00:00.000Z") },
      courseId: "c",
      universityId: "u",
      facultyId: "f",
      departmentId: "d",
      session: "2020-21",
    });
  });

  test("a one-sided date range sets only that bound", () => {
    expect(buildRollupWhere("quizzes", { from: "2026-11-01" })).toEqual({
      kind: "QUIZ",
      day: { gte: new Date("2026-11-01T00:00:00.000Z") },
    });
    expect(buildRollupWhere("quizzes", { to: "2026-11-01" })).toEqual({
      kind: "QUIZ",
      day: { lte: new Date("2026-11-01T00:00:00.000Z") },
    });
  });
});

describe("grouping", () => {
  test("keys follow the chosen dimension", () => {
    const sample = row({ moduleId: "m1", questionId: "q1" });
    expect(groupKeyOf(sample, "day")).toBe("2026-11-13");
    expect(groupKeyOf(sample, "month")).toBe("2026-11");
    expect(groupKeyOf(sample, "course")).toBe("course-1");
    expect(groupKeyOf(sample, "module")).toBe("m1");
    expect(groupKeyOf(sample, "question")).toBe("q1");
    expect(groupKeyOf(sample, "university")).toBe("uni-1");
    expect(groupKeyOf(sample, "faculty")).toBe("fac-1");
    expect(groupKeyOf(sample, "department")).toBe("dept-1");
    expect(groupKeyOf(sample, "session")).toBe("2020-21");
  });

  test("sums rows of the same group across days", () => {
    const accumulator = new GroupAccumulator("department");
    accumulator.add(row({ day: "2026-11-12", metrics: metrics({ registered: 3 }) }));
    accumulator.add(row({ day: "2026-11-13", metrics: metrics({ registered: 4, verified: 2 }) }));
    accumulator.add(row({ departmentId: "dept-2", metrics: metrics({ registered: 1 }) }));
    const groups = accumulator.result();
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.key === "dept-1")?.totals).toMatchObject({
      registered: 7,
      verified: 2,
    });
  });

  test("a group by is only allowed where the series has that dimension", () => {
    expect(isGroupByAllowed("enrollments", "module")).toBe(false);
    expect(isGroupByAllowed("quizzes", "question")).toBe(false);
    expect(isGroupByAllowed("questions", "question")).toBe(true);
    expect(isGroupByAllowed("modules", "session")).toBe(true);
  });
});

describe("small group suppression", () => {
  const group = (
    series: "enrollments" | "modules" | "quizzes" | "questions",
    totals: Partial<RollupMetrics>,
  ) => toInsightGroup(series, { key: "k", totals: metrics(totals) }, "Label");

  test("withholds every value of a group under five students and marks it suppressed", () => {
    const result = group("enrollments", { registered: 4, verified: 3, completed: 1 });
    expect(result.suppressed).toBe(true);
    expect(result.students).toBeNull();
    expect(Object.values(result.values).every((value) => value === null)).toBe(true);
  });

  test("shows a group with exactly five students", () => {
    const result = group("enrollments", { registered: 5, verified: 2 });
    expect(result.suppressed).toBe(false);
    expect(result.students).toBe(5);
    expect(result.values).toMatchObject({ registered: 5, verified: 2 });
  });

  test("an enrollment group is sized by its largest stage", () => {
    expect(studentsIn("enrollments", metrics({ registered: 1, approved: 9 }))).toBe(9);
  });

  test("a module group is sized by its largest stage", () => {
    expect(studentsIn("modules", metrics({ started: 2, quizReady: 6, completed: 4 }))).toBe(6);
  });

  test("a quiz group is sized by distinct students who attempted, not attempts", () => {
    const result = group("quizzes", { attempts: 40, passedAttempts: 10, attemptedStudents: 3 });
    expect(result.suppressed).toBe(true);
  });

  test("a question group is sized by distinct students who were asked, not answers", () => {
    const result = group("questions", { answered: 30, missed: 12, askedStudents: 4 });
    expect(result.suppressed).toBe(true);
    const shown = group("questions", { answered: 30, missed: 12, askedStudents: 25 });
    expect(shown.values).toEqual({ answered: 30, missed: 12 });
  });

  test("the output never carries the internal student measure for questions", () => {
    const shown = group("questions", { answered: 6, missed: 1, askedStudents: 6 });
    expect(Object.keys(shown.values)).toEqual(["answered", "missed"]);
  });
});

describe("toCsv", () => {
  test("writes a header, one line per group and blanks for withheld values", () => {
    const csv = toCsv(
      ["registered", "verified"],
      [
        {
          key: "a",
          label: "Law",
          suppressed: false,
          students: 8,
          values: { registered: 8, verified: 5 },
        },
        {
          key: "b",
          label: "Arts",
          suppressed: true,
          students: null,
          values: { registered: null, verified: null },
        },
      ],
    );
    expect(csv).toBe("group,registered,verified,suppressed\r\nLaw,8,5,no\r\nArts,,,yes\r\n");
  });

  test("quotes commas and quotes and defuses spreadsheet formulas", () => {
    const csv = toCsv(
      ["registered"],
      [
        {
          key: "a",
          label: 'Dept "A", North',
          suppressed: false,
          students: 6,
          values: { registered: 6 },
        },
        {
          key: "b",
          label: "=HYPERLINK(1)",
          suppressed: false,
          students: 6,
          values: { registered: 6 },
        },
      ],
    );
    expect(csv).toContain('"Dept ""A"", North",6,no');
    expect(csv).toContain("'=HYPERLINK(1),6,no");
  });
});
