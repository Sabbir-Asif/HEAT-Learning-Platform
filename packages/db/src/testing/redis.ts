import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";

export interface TestRedis {
  url: string;
  keyPrefix: string;
  client: Redis;
  close: () => Promise<void>;
}

export const connectRedis = (url: string): TestRedis => {
  const keyPrefix = `test:${randomUUID()}:`;
  const client = new Redis(url, { keyPrefix });
  return {
    url,
    keyPrefix,
    client,
    close: async () => {
      const keys = await client.keys("*");
      if (keys.length > 0) {
        await client.del(...keys.map((key) => key.slice(keyPrefix.length)));
      }
      client.disconnect();
    },
  };
};
