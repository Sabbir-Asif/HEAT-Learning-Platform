export const refreshLifetimeFraction = 0.6;
export const minimumRefreshDelayMs = 5000;
export const repeatForbiddenWindowMs = 5000;

export interface SessionWindow {
  issuedAtMs: number;
  expiresAtMs: number;
}

export const sessionWindowOf = (expiresAt: string, nowMs: number): SessionWindow => {
  const expiresAtMs = Date.parse(expiresAt);
  return { issuedAtMs: nowMs, expiresAtMs: Number.isNaN(expiresAtMs) ? nowMs : expiresAtMs };
};

export const refreshDueAtMs = (window: SessionWindow): number => {
  const lifetime = Math.max(window.expiresAtMs - window.issuedAtMs, 0);
  return window.issuedAtMs + Math.max(lifetime * refreshLifetimeFraction, minimumRefreshDelayMs);
};

export const refreshDelayMs = (window: SessionWindow, nowMs: number): number =>
  Math.max(refreshDueAtMs(window) - nowMs, 0);

export const isRefreshDue = (window: SessionWindow, nowMs: number): boolean =>
  nowMs >= refreshDueAtMs(window);

export type RecoveryOutcome = "recovered" | "refused";

export interface RefreshedSession {
  expiresAt: string;
}

export interface RefreshCoordinator {
  refresh: () => Promise<RecoveryOutcome>;
  recoverFromForbidden: () => Promise<RecoveryOutcome>;
  window: () => SessionWindow;
  reset: () => void;
}

export interface RefreshCoordinatorOptions {
  refreshSession: () => Promise<RefreshedSession>;
  initialExpiresAt: string;
  now?: () => number;
}

export const createRefreshCoordinator = (options: RefreshCoordinatorOptions): RefreshCoordinator => {
  const now = options.now ?? Date.now;
  let sessionWindow = sessionWindowOf(options.initialExpiresAt, now());
  let inFlight: Promise<RecoveryOutcome> | null = null;
  let lastRecoveredAtMs: number | null = null;

  const start = (): Promise<RecoveryOutcome> => {
    if (inFlight) return inFlight;
    const attempt = options
      .refreshSession()
      .then((session): RecoveryOutcome => {
        const at = now();
        sessionWindow = sessionWindowOf(session.expiresAt, at);
        lastRecoveredAtMs = at;
        return "recovered";
      })
      .catch((): RecoveryOutcome => "refused")
      .finally(() => {
        inFlight = null;
      });
    inFlight = attempt;
    return attempt;
  };

  const recoverFromForbidden = (): Promise<RecoveryOutcome> => {
    if (inFlight) return inFlight;
    if (lastRecoveredAtMs !== null && now() - lastRecoveredAtMs < repeatForbiddenWindowMs) {
      return Promise.resolve("refused");
    }
    return start();
  };

  return {
    refresh: start,
    recoverFromForbidden,
    window: () => sessionWindow,
    reset: () => {
      lastRecoveredAtMs = null;
    },
  };
};
