import { afterEach, beforeEach, inject } from "vitest";
import {
  cloneDatabase,
  connectRedis,
  type InfrastructureHandle,
  type TestDatabase,
  type TestRedis,
} from "../../src/testing";

declare module "vitest" {
  export interface ProvidedContext {
    infrastructure: InfrastructureHandle;
  }
}

export type { TestDatabase };

export const withDatabase = (): Promise<TestDatabase> => {
  const { postgresUrl, templateName } = inject("infrastructure");
  return cloneDatabase(postgresUrl, templateName);
};

const lifecycle = <T>(
  open: () => T | Promise<T>,
  close: (value: T) => Promise<void>,
  hooks: { before: typeof beforeEach; after: typeof afterEach },
  name: string,
): (() => T) => {
  let current: T | undefined;
  hooks.before(async () => {
    current = await open();
  });
  hooks.after(async () => {
    if (current !== undefined) {
      await close(current);
    }
    current = undefined;
  });
  return () => {
    if (current === undefined) {
      throw new Error(`${name} can only be read inside a test or a hook`);
    }
    return current;
  };
};

export const useTestDatabase = () =>
  lifecycle(
    withDatabase,
    (database) => database.close(),
    { before: beforeEach, after: afterEach },
    "useTestDatabase",
  );

export const useTestRedis = () =>
  lifecycle(
    (): TestRedis => connectRedis(inject("infrastructure").redisUrl),
    (redis) => redis.close(),
    { before: beforeEach, after: afterEach },
    "useTestRedis",
  );
