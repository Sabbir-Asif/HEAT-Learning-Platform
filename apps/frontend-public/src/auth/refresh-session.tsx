"use client";

import { useStudentAuthRefresh } from "@heat/api-client";
import { Skeleton } from "@heat/ui";
import { useEffect, useRef } from "react";
import { signInLocation } from "./sign-in-location";

const guardKey = "heat:session-refreshed-at";
const guardWindowMs = 10_000;

function recentlyRefreshed(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(guardKey));
    return Number.isFinite(at) && Date.now() - at < guardWindowMs;
  } catch {
    return false;
  }
}

function markRefreshed(): void {
  try {
    window.sessionStorage.setItem(guardKey, String(Date.now()));
  } catch {
    return;
  }
}

export function RefreshSession({ next }: { next: string }) {
  const { mutate } = useStudentAuthRefresh();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (recentlyRefreshed()) {
      window.location.replace(signInLocation(next));
      return;
    }
    mutate(undefined, {
      onSuccess: () => {
        markRefreshed();
        window.location.replace(next);
      },
      onError: () => window.location.replace(signInLocation(next)),
    });
  }, [mutate, next]);

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Restoring your session</span>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
