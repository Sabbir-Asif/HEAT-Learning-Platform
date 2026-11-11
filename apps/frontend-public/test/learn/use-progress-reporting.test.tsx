import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  useProgressReporting,
  isRetryableProgressError,
  storageKeyFor,
} from "../../src/learn/use-progress-reporting";
import { ApiError } from "@heat/api-client";
import type { PlayerProgress } from "@heat/ui/player";
import { mount } from "./mount";

const sessionId = "0198f1a0-0000-7000-8000-0000000000b1";
const videoId = "0198f1a0-0000-7000-8000-0000000000a1";
const courseId = "0198f1a0-0000-7000-8000-0000000000c1";

const respond = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("isRetryableProgressError", () => {
  test("retries network, throttling, auth refresh and server errors but not refusals", () => {
    const error = (status: number) => new ApiError({ status, code: "INTERNAL" });
    expect(isRetryableProgressError(new TypeError("fetch failed"))).toBe(true);
    for (const status of [0, 401, 429, 500, 503]) {
      expect(isRetryableProgressError(error(status))).toBe(true);
    }
    for (const status of [400, 403, 404, 409]) {
      expect(isRetryableProgressError(error(status))).toBe(false);
    }
  });
});

describe("useProgressReporting", () => {
  const Probe = ({
    session,
    onReady,
  }: {
    session: string | null;
    onReady: (fn: (p: PlayerProgress) => void) => void;
  }) => {
    const report = useProgressReporting({ courseId, videoId, sessionId: session });
    onReady(report);
    return null;
  };

  const run = async (session: string | null) => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    let report: ((progress: PlayerProgress) => void) | undefined;
    await mount(
      <QueryClientProvider client={client}>
        <Probe session={session} onReady={(fn) => (report = fn)} />
      </QueryClientProvider>,
    );
    return { report: report!, invalidate };
  };

  test("posts a report to the progress route and refreshes the learning structure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        respond({ coveragePercent: 10, resumePositionSeconds: 5, completed: false }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { report, invalidate } = await run(sessionId);
    await act(async () => {
      report({
        reason: "interval",
        intervals: [{ start: 0, end: 5 }],
        positionSeconds: 5,
      });
    });
    await vi.waitFor(() => expect(invalidate).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/videos/${videoId}/progress`);
    expect(JSON.parse(init.body as string)).toEqual({
      sessionId,
      sequence: 1,
      positionSeconds: 5,
      intervals: [{ start: 0, end: 5 }],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [`/api/courses/${courseId}/learning-structure`],
    });
  });

  test("reports nothing when there is no playback session", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { report } = await run(null);
    await act(async () => {
      report({
        reason: "interval",
        intervals: [{ start: 0, end: 5 }],
        positionSeconds: 5,
      });
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keys stored batches by video", () => {
    expect(storageKeyFor("v1")).toBe("heat.progress.v1");
  });
});
