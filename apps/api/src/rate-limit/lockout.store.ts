export abstract class LockoutStore {
  abstract increment(key: string, memorySeconds: number): Promise<number>;
  abstract lockUntil(key: string, untilMs: number, memorySeconds: number): Promise<void>;
  abstract lockedUntil(key: string): Promise<number>;
  abstract clear(key: string): Promise<void>;
}
