"use client";

import {
  getLearningStructureQueryKey,
  getProgressRecordUrl,
  isApiError,
  readDocumentCookie,
  useProgressRecord,
} from "@heat/api-client";
import { studentCsrf } from "@heat/contracts";
import type { ProgressResponse } from "@heat/contracts";
import type { PlayerProgress } from "@heat/ui/player";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { createBeaconSender, createProgressReporter } from "./progress-reporter";
import type { ReporterStorage } from "./progress-reporter";

export interface ProgressReportingOptions {
  courseId: string;
  videoId: string;
  sessionId: string | null;
}

export const storageKeyFor = (videoId: string): string => `heat.progress.${videoId}`;

export const isRetryableProgressError = (error: unknown): boolean =>
  !isApiError(error) ||
  error.status === 0 ||
  error.status === 401 ||
  error.status === 429 ||
  error.status >= 500;

const browserStorage = (): ReporterStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function useProgressReporting({
  courseId,
  videoId,
  sessionId,
}: ProgressReportingOptions): (progress: PlayerProgress) => void {
  const queryClient = useQueryClient();
  const { mutateAsync } = useProgressRecord();
  const reporter = useMemo(() => {
    if (sessionId === null) return null;
    let last: ProgressResponse | null = null;
    return createProgressReporter({
      sessionId,
      send: (batch) => mutateAsync({ id: videoId, data: batch }),
      beacon: createBeaconSender({
        url: getProgressRecordUrl(videoId),
        readToken: () => readDocumentCookie(studentCsrf.cookie),
        sendBeacon:
          typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
            ? (url, data) => navigator.sendBeacon(url, data)
            : undefined,
      }),
      isRetryable: isRetryableProgressError,
      storage: browserStorage(),
      storageKey: storageKeyFor(videoId),
      onAccepted: (response) => {
        const previous = last;
        last = response;
        if (
          previous !== null &&
          previous.coveragePercent === response.coveragePercent &&
          previous.completed === response.completed
        ) {
          return;
        }
        void queryClient.invalidateQueries({ queryKey: getLearningStructureQueryKey(courseId) });
      },
    });
  }, [sessionId, videoId, courseId, queryClient, mutateAsync]);

  useEffect(() => {
    if (reporter === null) return;
    const flush = () => void reporter.flush();
    flush();
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener("online", flush);
      reporter.dispose();
    };
  }, [reporter]);

  return useCallback((progress: PlayerProgress) => reporter?.report(progress), [reporter]);
}
