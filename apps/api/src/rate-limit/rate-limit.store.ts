export interface RateLimitHit {
  count: number;
  ttlSeconds: number;
}

export abstract class RateLimitStore {
  abstract hit(key: string, windowSeconds: number): Promise<RateLimitHit>;
}
