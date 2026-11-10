import type { LockoutPolicy } from "../core";

export abstract class LockoutStore {
  abstract reserve(
    attemptKey: string,
    accountKey: string,
    nowMs: number,
    policy: LockoutPolicy,
  ): Promise<number>;
  abstract release(attemptKey: string, accountKey: string): Promise<void>;
}
