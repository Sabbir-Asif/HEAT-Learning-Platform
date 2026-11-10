export type CaptchaAttempt = "passed" | "wrong" | "exhausted" | "gone";

export abstract class CaptchaStore {
  abstract save(id: string, answerHash: string, ttlSeconds: number): Promise<void>;
  abstract attempt(id: string, answerHash: string, maxTries: number): Promise<CaptchaAttempt>;
  abstract remove(id: string): Promise<void>;
}
