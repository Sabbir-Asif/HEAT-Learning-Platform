import { describe, expect, test, vi } from "vitest";
import {
  createRefreshCoordinator,
  isRefreshDue,
  minimumRefreshDelayMs,
  refreshDelayMs,
  repeatForbiddenWindowMs,
  sessionWindowOf,
} from "../../src/player/session-refresh";

const start = Date.parse("2026-11-12T10:00:00Z");
const expiresAt = "2026-11-12T10:10:00Z";

describe("refresh scheduling", () => {
  test("refreshes at 60 percent of the cookie lifetime", () => {
    const window = sessionWindowOf(expiresAt, start);
    expect(refreshDelayMs(window, start)).toBe(360000);
    expect(refreshDelayMs(window, start + 100000)).toBe(260000);
  });

  test("never returns a negative delay", () => {
    const window = sessionWindowOf(expiresAt, start);
    expect(refreshDelayMs(window, start + 900000)).toBe(0);
  });

  test("waits a minimum delay for an almost expired cookie", () => {
    const window = sessionWindowOf("2026-11-12T10:00:01Z", start);
    expect(refreshDelayMs(window, start)).toBe(minimumRefreshDelayMs);
  });

  test("is due once 60 percent of the lifetime has passed", () => {
    const window = sessionWindowOf(expiresAt, start);
    expect(isRefreshDue(window, start + 359000)).toBe(false);
    expect(isRefreshDue(window, start + 360000)).toBe(true);
  });

  test("treats an unreadable expiry as already due", () => {
    const window = sessionWindowOf("not a date", start);
    expect(isRefreshDue(window, start + minimumRefreshDelayMs)).toBe(true);
  });
});

describe("refresh coordinator", () => {
  const setup = (refreshSession: () => Promise<{ expiresAt: string }>) => {
    let clock = start;
    const coordinator = createRefreshCoordinator({
      refreshSession,
      initialExpiresAt: expiresAt,
      now: () => clock,
    });
    return {
      coordinator,
      advance: (ms: number) => {
        clock += ms;
      },
    };
  };

  test("shares one refresh between concurrent forbidden responses", async () => {
    const refreshSession = vi.fn().mockResolvedValue({ expiresAt });
    const { coordinator } = setup(refreshSession);
    const outcomes = await Promise.all([
      coordinator.recoverFromForbidden(),
      coordinator.recoverFromForbidden(),
      coordinator.recoverFromForbidden(),
    ]);
    expect(outcomes).toEqual(["recovered", "recovered", "recovered"]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  test("shares an in-flight scheduled refresh with a forbidden response", async () => {
    const refreshSession = vi.fn().mockResolvedValue({ expiresAt });
    const { coordinator } = setup(refreshSession);
    const scheduled = coordinator.refresh();
    const forbidden = coordinator.recoverFromForbidden();
    expect(await Promise.all([scheduled, forbidden])).toEqual(["recovered", "recovered"]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  test("stops when the refresh is refused", async () => {
    const refreshSession = vi.fn().mockRejectedValue(new Error("forbidden"));
    const { coordinator } = setup(refreshSession);
    expect(await coordinator.recoverFromForbidden()).toBe("refused");
  });

  test("stops when the 403 repeats right after a successful refresh", async () => {
    const refreshSession = vi.fn().mockResolvedValue({ expiresAt });
    const { coordinator, advance } = setup(refreshSession);
    expect(await coordinator.recoverFromForbidden()).toBe("recovered");
    advance(repeatForbiddenWindowMs - 1);
    expect(await coordinator.recoverFromForbidden()).toBe("refused");
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  test("refreshes again for a 403 long after the last refresh", async () => {
    const refreshSession = vi.fn().mockResolvedValue({ expiresAt });
    const { coordinator, advance } = setup(refreshSession);
    await coordinator.recoverFromForbidden();
    advance(repeatForbiddenWindowMs + 1);
    expect(await coordinator.recoverFromForbidden()).toBe("recovered");
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  test("allows a retry after the student asks for one", async () => {
    const refreshSession = vi
      .fn()
      .mockRejectedValueOnce(new Error("forbidden"))
      .mockResolvedValue({ expiresAt });
    const { coordinator } = setup(refreshSession);
    expect(await coordinator.recoverFromForbidden()).toBe("refused");
    coordinator.reset();
    expect(await coordinator.refresh()).toBe("recovered");
  });

  test("moves the refresh window forward after a refresh", async () => {
    const refreshSession = vi.fn().mockResolvedValue({ expiresAt: "2026-11-12T10:20:00Z" });
    const { coordinator, advance } = setup(refreshSession);
    advance(400000);
    await coordinator.refresh();
    expect(coordinator.window().expiresAtMs).toBe(Date.parse("2026-11-12T10:20:00Z"));
    expect(coordinator.window().issuedAtMs).toBe(start + 400000);
  });
});
