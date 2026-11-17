import { describe, expect, test } from "vitest";
import { buildCsv } from "@heat/ui/charts";
import {
  funnelRows,
  funnelSummary,
  hasSuppressedValues,
  insightFilterKeys,
  suppressionNote,
  toInsightParams,
  trendRows,
  trendSummary,
} from "../../src/insights/insights-model";
import type { InsightFilterValues } from "../../src/insights/insights-model";

const filters = (values: Partial<InsightFilterValues> = {}): InsightFilterValues =>
  ({
    ...Object.fromEntries(insightFilterKeys.map((key) => [key, ""])),
    ...values,
  }) as InsightFilterValues;

const funnel = (values: Array<number | null>, suppressed = false) => ({
  stages: (["registered", "verified", "approved", "started", "completed"] as const).map(
    (key, index) => ({ key, value: values[index] ?? null }),
  ),
  suppressed,
  suppressionThreshold: 5,
  refreshedAt: null,
});

const trend = (
  groups: Array<{ label: string; suppressed: boolean; registered: number | null }>,
) => ({
  series: "enrollments" as const,
  groupBy: "day" as const,
  columns: ["registered", "verified"],
  groups: groups.map((group) => ({
    key: group.label,
    label: group.label,
    suppressed: group.suppressed,
    students: group.suppressed ? null : 9,
    values: { registered: group.registered, verified: group.suppressed ? null : 3 },
  })),
  suppressionThreshold: 5,
  refreshedAt: null,
});

describe("toInsightParams", () => {
  test("maps the url filters to the api params", () => {
    expect(
      toInsightParams(
        filters({
          from: "2026-01-01",
          to: "2026-02-01",
          course: "c1",
          university: "u1",
          faculty: "f1",
          department: "d1",
          session: "2020-21",
        }),
      ),
    ).toEqual({
      from: "2026-01-01",
      to: "2026-02-01",
      courseId: "c1",
      universityId: "u1",
      facultyId: "f1",
      departmentId: "d1",
      session: "2020-21",
    });
  });

  test("sends nothing for empty filters", () => {
    expect(toInsightParams(filters())).toEqual({});
  });

  test("drops a faculty without its university and a malformed session", () => {
    expect(toInsightParams(filters({ faculty: "f1", department: "d1", session: "2020" }))).toEqual(
      {},
    );
  });
});

describe("funnelRows", () => {
  test("lists every stage in order with its value", () => {
    expect(funnelRows(funnel([10, 8, 6, 3, 1]))).toEqual([
      { stage: "Registered", students: 10 },
      { stage: "Verified", students: 8 },
      { stage: "Approved", students: 6 },
      { stage: "Started", students: 3 },
      { stage: "Completed", students: 1 },
    ]);
  });

  test("is empty when there is no data", () => {
    expect(funnelRows(funnel([0, 0, 0, 0, 0]))).toEqual([]);
  });

  test("keeps blank values when the funnel is withheld", () => {
    expect(
      funnelRows(funnel([null, null, null, null, null], true)).map((row) => row.students),
    ).toEqual([null, null, null, null, null]);
  });
});

describe("trendRows", () => {
  test("one row per day with a blank for a withheld value", () => {
    const rows = trendRows(
      trend([
        { label: "2026-11-13", suppressed: false, registered: 7 },
        { label: "2026-11-14", suppressed: true, registered: null },
      ]),
    );
    expect(rows).toEqual([
      { day: "2026-11-13", registered: 7, verified: 3 },
      { day: "2026-11-14", registered: null, verified: null },
    ]);
  });

  test("the downloaded csv carries the same series the chart shows", () => {
    const rows = trendRows(
      trend([
        { label: "2026-11-13", suppressed: false, registered: 7 },
        { label: "2026-11-14", suppressed: true, registered: null },
      ]),
    );
    const csv = buildCsv(
      [
        { key: "day", label: "Day" },
        { key: "registered", label: "Registered" },
        { key: "verified", label: "Verified" },
      ],
      rows,
    );
    expect(csv.replace("﻿", "").split("\r\n")).toEqual([
      "Day,Registered,Verified",
      "2026-11-13,7,3",
      "2026-11-14,,",
    ]);
  });
});

describe("summaries and the suppression note", () => {
  test("the funnel summary names every stage", () => {
    expect(funnelSummary(funnel([10, 8, 6, 3, 1]))).toBe(
      "Enrollment funnel. Registered 10, Verified 8, Approved 6, Started 3, Completed 1.",
    );
    expect(funnelSummary(funnel([null, null, null, null, null], true))).toContain("withheld");
  });

  test("the trend summary gives the range, totals and withheld days", () => {
    const text = trendSummary(
      trend([
        { label: "2026-11-13", suppressed: false, registered: 7 },
        { label: "2026-11-14", suppressed: true, registered: null },
      ]),
    );
    expect(text).toContain("from 2026-11-13 to 2026-11-14");
    expect(text).toContain("Registered 7");
    expect(text).toContain("1 day is withheld");
  });

  test("the note appears when the funnel or any day is withheld", () => {
    const shown = trend([{ label: "2026-11-13", suppressed: false, registered: 7 }]);
    const hidden = trend([{ label: "2026-11-13", suppressed: true, registered: null }]);
    expect(hasSuppressedValues(funnel([10, 8, 6, 3, 1]), shown)).toBe(false);
    expect(hasSuppressedValues(funnel([10, 8, 6, 3, 1]), hidden)).toBe(true);
    expect(hasSuppressedValues(funnel([null, null, null, null, null], true), shown)).toBe(true);
    expect(suppressionNote(5)).toContain("fewer than 5 students");
  });
});
