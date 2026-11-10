import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../core";
import { CaptchaStore } from "./captcha.store";
import type { CaptchaAttempt } from "./captcha.store";

const keyFor = (id: string): string => `captcha:${id}`;

const attemptScript = `
local stored = redis.call('HGET', KEYS[1], 'hash')
if not stored then return 0 end
if stored == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
local tries = redis.call('HINCRBY', KEYS[1], 'tries', 1)
if tries >= tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return 2
end
return 3
`;

const outcomes: Readonly<Record<number, CaptchaAttempt>> = {
  0: "gone",
  1: "passed",
  2: "exhausted",
  3: "wrong",
};

@Injectable()
export class RedisCaptchaStore extends CaptchaStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {
    super();
  }

  async save(id: string, answerHash: string, ttlSeconds: number): Promise<void> {
    await this.redis
      .multi()
      .hset(keyFor(id), { hash: answerHash, tries: 0 })
      .expire(keyFor(id), ttlSeconds)
      .exec();
  }

  async attempt(id: string, answerHash: string, maxTries: number): Promise<CaptchaAttempt> {
    const result = await this.redis.eval(attemptScript, 1, keyFor(id), answerHash, maxTries);
    return outcomes[Number(result)] ?? "gone";
  }

  async remove(id: string): Promise<void> {
    await this.redis.del(keyFor(id));
  }
}
