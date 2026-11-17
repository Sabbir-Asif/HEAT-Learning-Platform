import { describe, expect, test, vi } from "vitest";
import { InsightsRefreshService, toRunSummary } from "../../src/insights/insights-refresh.service";
import type { RunRecord } from "../../src/core";

const now = new Date("2026-11-12T20:00:00.000Z");

const run: RunRecord = {
  id: "run-1",
  trigger: "MANUAL",
  status: "PENDING",
  fromDay: "2026-11-12",
  toDay: "2026-11-13",
  requestedById: "admin-1",
  requestedAt: now,
  startedAt: null,
  heartbeatAt: null,
  finishedAt: null,
  rowsWritten: 0,
  error: null,
};

const build = (outcome: unknown) => {
  const request = vi.fn().mockResolvedValue(outcome);
  const capture = vi.fn();
  const service = new InsightsRefreshService(
    {} as never,
    { now: () => now },
    { request } as never,
    { capture } as never,
  );
  return { service, request, capture };
};

describe("InsightsRefreshService.refresh", () => {
  test("queues a refresh of yesterday and today in Dhaka time and audits it", async () => {
    const { service, request, capture } = build({ outcome: "accepted", run });
    const result = await service.refresh("admin-1");
    expect(request).toHaveBeenCalledWith({
      trigger: "MANUAL",
      fromDay: "2026-11-12",
      toDay: "2026-11-13",
      requestedById: "admin-1",
      startImmediately: false,
    });
    expect(result.run.status).toBe("PENDING");
    expect(capture).toHaveBeenCalledWith({
      entityId: "run-1",
      after: { fromDay: "2026-11-12", toDay: "2026-11-13" },
    });
  });

  test("answers 409 INSIGHTS_REFRESH_RUNNING while a run is active and records nothing", async () => {
    const { service, capture } = build({ outcome: "already-running", runId: "run-0" });
    await expect(service.refresh("admin-1")).rejects.toMatchObject({
      status: 409,
      code: "INSIGHTS_REFRESH_RUNNING",
    });
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("InsightsRefreshService.status", () => {
  test("reports the active run, the last finished run and the last success", async () => {
    const finished = {
      ...run,
      status: "FAILED" as const,
      finishedAt: new Date("2026-11-12T19:00:00.000Z"),
      fromDay: new Date("2026-11-11T00:00:00.000Z"),
      toDay: new Date("2026-11-12T00:00:00.000Z"),
    };
    const active = {
      ...run,
      fromDay: new Date("2026-11-12T00:00:00.000Z"),
      toDay: new Date("2026-11-13T00:00:00.000Z"),
    };
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(finished)
      .mockResolvedValueOnce({ finishedAt: new Date("2026-11-11T19:00:00.000Z") });
    const service = new InsightsRefreshService(
      { insightRun: { findFirst } } as never,
      { now: () => now },
      {} as never,
      {} as never,
    );
    const status = await service.status();
    expect(status.running).toBe(true);
    expect(status.activeRun?.id).toBe("run-1");
    expect(status.lastRun?.failed).toBe(true);
    expect(status.lastSuccessfulAt).toBe("2026-11-11T19:00:00.000Z");
  });

  test("reports an idle system that never ran", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new InsightsRefreshService(
      { insightRun: { findFirst } } as never,
      { now: () => now },
      {} as never,
      {} as never,
    );
    expect(await service.status()).toEqual({
      running: false,
      activeRun: null,
      lastRun: null,
      lastSuccessfulAt: null,
    });
  });
});

test("toRunSummary exposes no requester identity", () => {
  expect(Object.keys(toRunSummary(run))).not.toContain("requestedById");
});
