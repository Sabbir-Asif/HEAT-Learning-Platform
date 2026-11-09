export abstract class RotationClaimStore {
  abstract claim(key: string, value: string, ttlSeconds: number): Promise<boolean>;
  abstract read(key: string): Promise<string | null>;
}
