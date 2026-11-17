import { describe, expect, test } from "vitest";
import {
  errorCodes,
  insightDefaultGroupBy,
  insightQuerySchema,
  insightSeriesGroupBy,
  insightSeriesParamsSchema,
  insightSuppressionThreshold,
} from "../src/index";

describe("insightQuerySchema", () => {
  test("accepts no filters", () => {
    expect(insightQuerySchema.parse({})).toEqual({});
  });

  test("accepts every shared filter and a group by", () => {
    const query = {
      from: "2026-11-01",
      to: "2026-11-10",
      courseId: "0198b3f0-0000-7000-8000-000000000001",
      universityId: "0198b3f0-0000-7000-8000-000000000002",
      facultyId: "0198b3f0-0000-7000-8000-000000000003",
      departmentId: "0198b3f0-0000-7000-8000-000000000004",
      session: "2020-21",
      groupBy: "department",
    };
    expect(insightQuerySchema.parse(query)).toEqual(query);
  });

  test("rejects an end date before the start date", () => {
    const result = insightQuerySchema.safeParse({ from: "2026-11-10", to: "2026-11-01" });
    expect(result.success).toBe(false);
  });

  test("rejects an impossible date, a bad session and an unknown group by", () => {
    expect(insightQuerySchema.safeParse({ from: "2026-02-30" }).success).toBe(false);
    expect(insightQuerySchema.safeParse({ session: "2020-22" }).success).toBe(false);
    expect(insightQuerySchema.safeParse({ groupBy: "student" }).success).toBe(false);
  });
});

describe("insight series", () => {
  test("the series path parameter is a closed list", () => {
    expect(insightSeriesParamsSchema.safeParse({ series: "quizzes" }).success).toBe(true);
    expect(insightSeriesParamsSchema.safeParse({ series: "students" }).success).toBe(false);
  });

  test("every default group by is allowed for its series", () => {
    for (const series of Object.keys(
      insightDefaultGroupBy,
    ) as (keyof typeof insightDefaultGroupBy)[]) {
      expect(insightSeriesGroupBy[series]).toContain(insightDefaultGroupBy[series]);
    }
  });

  test("the suppression threshold is five students", () => {
    expect(insightSuppressionThreshold).toBe(5);
  });

  test("the refresh conflict has a published error code", () => {
    expect(errorCodes).toContain("INSIGHTS_REFRESH_RUNNING");
  });
});
