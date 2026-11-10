import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../core";
import { RotationClaimStore } from "./rotation-claim.store";

@Injectable()
export class RedisRotationClaimStore extends RotationClaimStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  async claim(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return (await this.redis.set(key, value, "EX", ttlSeconds, "NX")) === "OK";
  }

  read(key: string): Promise<string | null> {
    return this.redis.get(key);
  }
}
