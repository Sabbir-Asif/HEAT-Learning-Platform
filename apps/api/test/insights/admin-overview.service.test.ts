import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AdminOverviewService } from "../../src/insights/admin-overview.service";
import { AdminOverviewController } from "../../src/insights/admin-overview.controller";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";

interface Fixture {
  groups?: Array<{ status: string; count: number }>;
  oldest?: Date | null;
  certificates?: number;
  quizRows?: unknown[];
  refreshedAt?: string | null;
}

const build = (fixture: Fixture = {}) => {
  const groupBy = vi
    .fn()
    .mockResolvedValue(
      (fixture.groups ?? []).map((g) => ({ status: g.status, _count: { _all: g.count } })),
    );
  const findFirst = vi
    .fn()
    .mockResolvedValue(
      fixture.oldest === undefined || fixture.oldest === null
        ? null
        : { requestedAt: fixture.oldest },
    );
  const count = vi.fn().mockResolvedValue(fixture.certificates ?? 0);
  const quizResults = vi.fn().mockResolvedValue({
    rows: fixture.quizRows ?? [],
    suppressionThreshold: 5,
    refreshedAt: fixture.refreshedAt ?? null,
  });
  const database = { enrollment: { groupBy, findFirst }, certificate: { count } };
  return {
    service: new AdminOverviewService(database as never, { quizResults } as never),
    groupBy,
    findFirst,
    count,
    quizResults,
  };
};

describe("AdminOverviewService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T06:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  test("counts enrollments by status in a fixed order, filling missing statuses with zero", async () => {
    const { service } = build({
      groups: [
        { status: "APPROVED", count: 12 },
        { status: "PENDING_APPROVAL", count: 3 },
        { status: "COMPLETED", count: 7 },
      ],
    });
    const overview = await service.describe({});
    expect(overview.statusCounts).toEqual([
      { status: "PENDING_VERIFICATION", count: 0 },
      { status: "PENDING_APPROVAL", count: 3 },
      { status: "APPROVED", count: 12 },
      { status: "COMPLETED", count: 7 },
      { status: "REJECTED", count: 0 },
      { status: "EXPIRED", count: 0 },
      { status: "REMOVED", count: 0 },
    ]);
    expect(overview.totalEnrollments).toBe(22);
    expect(overview.pending.count).toBe(3);
  });

  test("reports the age of the oldest pending request in seconds", async () => {
    const { service, findFirst } = build({
      groups: [{ status: "PENDING_APPROVAL", count: 2 }],
      oldest: new Date("2026-11-15T06:00:00.000Z"),
    });
    const overview = await service.describe({});
    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { status: "PENDING_APPROVAL", deletedAt: null },
      orderBy: { requestedAt: "asc" },
    });
    expect(overview.pending.oldestRequestedAt).toBe("2026-11-15T06:00:00.000Z");
    expect(overview.pending.oldestAgeSeconds).toBe(2 * 24 * 60 * 60);
  });

  test("has no oldest request when nothing is pending", async () => {
    const { service } = build();
    const overview = await service.describe({});
    expect(overview.pending).toEqual({ count: 0, oldestRequestedAt: null, oldestAgeSeconds: null });
  });

  test("scopes every count to the chosen course and counts only certificates not revoked", async () => {
    const { service, groupBy, count, quizResults } = build({ certificates: 4 });
    const overview = await service.describe({ courseId: "course-1" });
    expect(groupBy.mock.calls[0]?.[0].where).toEqual({ deletedAt: null, courseId: "course-1" });
    expect(count.mock.calls[0]?.[0].where).toEqual({
      revokedAt: null,
      enrollment: { deletedAt: null, courseId: "course-1" },
    });
    expect(quizResults).toHaveBeenCalledWith({ courseId: "course-1" });
    expect(overview.certificatesIssued).toBe(4);
  });

  test("passes through pass rates, withholds small modules and carries the refresh time", async () => {
    const { service } = build({
      quizRows: [
        {
          moduleId: "m1",
          label: "Module 1",
          suppressed: false,
          attemptedStudents: 20,
          passRate: 85.5,
        },
        {
          moduleId: "m2",
          label: "Module 2",
          suppressed: true,
          attemptedStudents: null,
          passRate: null,
        },
      ],
      refreshedAt: "2026-11-16T20:00:00.000Z",
    });
    const overview = await service.describe({});
    expect(overview.passRates).toEqual([
      { moduleId: "m1", label: "Module 1", suppressed: false, students: 20, passRate: 85.5 },
      { moduleId: "m2", label: "Module 2", suppressed: true, students: null, passRate: null },
    ]);
    expect(overview.suppressionThreshold).toBe(5);
    expect(overview.refreshedAt).toBe("2026-11-16T20:00:00.000Z");
  });
});

describe("AdminOverviewController", () => {
  test("is admin only and passes the query to the service", async () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, AdminOverviewController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, AdminOverviewController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
    const describe = vi.fn().mockResolvedValue({});
    await new AdminOverviewController({ describe } as never).get({ courseId: "c" });
    expect(describe).toHaveBeenCalledWith({ courseId: "c" });
  });
});
