export const staleRunMs = 30 * 60 * 1000;

export interface ActiveRun {
  id: string;
  status: "PENDING" | "RUNNING";
  requestedAt: Date;
  startedAt: Date | null;
  heartbeatAt: Date | null;
}

export type ClaimDecision =
  | { outcome: "start" }
  | { outcome: "recover"; runId: string }
  | { outcome: "already-running"; runId: string };

export const lastActivityOf = (run: ActiveRun): Date =>
  run.heartbeatAt ?? run.startedAt ?? run.requestedAt;

export const decideClaim = (active: ActiveRun | null, now: Date): ClaimDecision => {
  if (active === null) return { outcome: "start" };
  const idleMs = now.getTime() - lastActivityOf(active).getTime();
  if (idleMs > staleRunMs) return { outcome: "recover", runId: active.id };
  return { outcome: "already-running", runId: active.id };
};
