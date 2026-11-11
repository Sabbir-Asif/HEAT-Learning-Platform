"use client";

import { useCaptchaIssue } from "@heat/api-client";
import type { CaptchaResponseDto } from "@heat/api-client";
import type { CaptchaStatus } from "@heat/ui";
import { useCallback, useEffect, useRef, useState } from "react";

export interface CaptchaState {
  status: CaptchaStatus;
  challenge: CaptchaResponseDto | undefined;
  refresh: () => void;
}

export function useCaptcha(): CaptchaState {
  const issue = useCaptchaIssue();
  const { mutate } = issue;
  const [challenge, setChallenge] = useState<CaptchaResponseDto>();
  const current = useRef<string | undefined>(undefined);
  const requested = useRef(false);

  const load = useCallback(
    (replaces: string | undefined) => {
      mutate(
        { data: replaces === undefined ? {} : { replaces } },
        {
          onSuccess: (next) => {
            current.current = next.id;
            setChallenge(next);
          },
        },
      );
    },
    [mutate],
  );

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    load(undefined);
  }, [load]);

  const refresh = useCallback(() => load(current.current), [load]);

  const status: CaptchaStatus =
    issue.isPending || issue.isIdle
      ? "loading"
      : issue.isError || challenge === undefined
        ? "error"
        : "ready";

  return { status, challenge, refresh };
}
