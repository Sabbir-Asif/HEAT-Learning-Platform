export interface TimeoutPolicy {
  factor: number;
  minSeconds: number;
  maxSeconds: number;
}

export const transcodeTimeoutMs = (durationSeconds: number, policy: TimeoutPolicy): number => {
  const scaled = durationSeconds * policy.factor;
  return Math.min(policy.maxSeconds, Math.max(policy.minSeconds, scaled)) * 1000;
};
