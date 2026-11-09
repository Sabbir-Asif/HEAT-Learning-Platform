export interface ClaimPolling {
  intervalMs: number;
  timeoutMs: number;
  sleep(milliseconds: number): Promise<void>;
}

export const CLAIM_POLLING = Symbol("CLAIM_POLLING");

export const defaultClaimPolling: ClaimPolling = {
  intervalMs: 50,
  timeoutMs: 1000,
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};
