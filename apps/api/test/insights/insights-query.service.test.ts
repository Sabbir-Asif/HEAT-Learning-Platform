import { describe, expect, test, vi } from "vitest";
import { InsightsQueryService } from "../../src/insights/insights-query.service";
import { emptyMetrics } from "../../src/core";

const rollupRow = (overrides: Record<string, unknown>) => ({
  id: "id",
  day: new Date("2026-11-13T00:00:00.000Z"),
  kind: "ENROLLMENT",
  key: "k",
  courseId: "course-1",
  moduleId: null,
  questionId: null,
  universityId: "uni-1",
  facultyId: "fac-1",
  departmentId: "dept-1",
  session: "2020-21",
  ...emptyMetrics(),
  ...overrides,
});

const build = (rows: unknown[]) => {
  const findMany = vi.fn().mockResolvedValue(rows);
  const database = {
    insightRollup: { findMany },
    insightRun: {
      findFirst: vi.fn().mockResolvedValue({ finishedAt: new Date("2026-11-13T02:00:00.000Z") }),
    },
    department: {
      findMany: vi.fn().mockResolvedValue([
        { id: "dept-1", name: "Law" },
        { id: "dept-2", name: "Arts" },
      ]),
    },
    $includingDeleted: () => database,
  };
  return { service: new InsightsQueryService(database as never), findMany };
};

describe("InsightsQueryService", () => {
  test("groups by department, labels groups and withholds the small one", async () => {
    const { service, findMany } = build([
      rollupRow({ id: "1", departmentId: "dept-1", registered: 8, verified: 6 }),
      rollupRow({ id: "2", departmentId: "dept-2", registered: 4, verified: 4 }),
    ]);
    const result = await service.query("enrollments", { groupBy: "department", courseId: "c" });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({ kind: "ENROLLMENT", courseId: "c" });
    expect(result.groups.map((group) => [group.label, group.suppressed])).toEqual([
      ["Arts", true],
      ["Law", false],
    ]);
    expect(result.groups[1]?.values).toMatchObject({ registered: 8, verified: 6 });
    expect(result.groups[0]?.values.registered).toBeNull();
    expect(result.suppressionThreshold).toBe(5);
    expect(result.refreshedAt).toBe("2026-11-13T02:00:00.000Z");
  });

  test("uses the series default group by and orders days ascending", async () => {
    const { service } = build([
      rollupRow({ id: "1", day: new Date("2026-11-14T00:00:00.000Z"), registered: 6 }),
      rollupRow({ id: "2", day: new Date("2026-11-13T00:00:00.000Z"), registered: 7 }),
    ]);
    const result = await service.query("enrollments", {});
    expect(result.groupBy).toBe("day");
    expect(result.groups.map((group) => group.key)).toEqual(["2026-11-13", "2026-11-14"]);
  });

  test("rejects a group by the series does not have", async () => {
    const { service } = build([]);
    await expect(service.query("enrollments", { groupBy: "module" })).rejects.toMatchObject({
      status: 400,
    });
  });

  test("the csv carries the same suppression", async () => {
    const { service } = build([rollupRow({ id: "1", departmentId: "dept-2", registered: 2 })]);
    const csv = await service.csv("enrollments", { groupBy: "department" });
    expect(csv).toBe(
      "group,registered,verified,approved,started,completed,suppressed\r\nArts,,,,,,yes\r\n",
    );
  });

  test("returns only aggregates, never an identity field", async () => {
    const { service } = build([rollupRow({ id: "1", registered: 9 })]);
    const result = await service.query("enrollments", { groupBy: "session" });
    expect(JSON.stringify(result)).not.toMatch(/userId|email|enrollmentId/);
  });

  test("the funnel sums every day into one set of stage totals", async () => {
    const { service, findMany } = build([
      rollupRow({
        id: "1",
        day: new Date("2026-11-13T00:00:00.000Z"),
        registered: 4,
        verified: 3,
        approved: 2,
      }),
      rollupRow({
        id: "2",
        day: new Date("2026-11-14T00:00:00.000Z"),
        registered: 6,
        verified: 5,
        approved: 4,
        started: 3,
        completed: 1,
      }),
    ]);
    const result = await service.funnel({ departmentId: "dept-1" });
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      kind: "ENROLLMENT",
      departmentId: "dept-1",
    });
    expect(result.suppressed).toBe(false);
    expect(result.stages).toEqual([
      { key: "registered", value: 10 },
      { key: "verified", value: 8 },
      { key: "approved", value: 6 },
      { key: "started", value: 3 },
      { key: "completed", value: 1 },
    ]);
    expect(result.refreshedAt).toBe("2026-11-13T02:00:00.000Z");
  });

  test("the funnel withholds every stage when the group is under the threshold", async () => {
    const { service } = build([rollupRow({ id: "1", registered: 3, verified: 2 })]);
    const result = await service.funnel({});
    expect(result.suppressed).toBe(true);
    expect(result.stages.every((stage) => stage.value === null)).toBe(true);
  });

  test("the funnel with no rows is zero and not suppressed", async () => {
    const { service } = build([]);
    const result = await service.funnel({});
    expect(result.suppressed).toBe(false);
    expect(result.stages.map((stage) => stage.value)).toEqual([0, 0, 0, 0, 0]);
  });
});
