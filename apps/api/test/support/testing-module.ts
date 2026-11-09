import type { INestApplication, ModuleMetadata } from "@nestjs/common";
import { Global, Module } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  cloneDatabase,
  createFactories,
  type Factories,
  type TestDatabase,
} from "@heat/db/testing";
import { afterEach, beforeEach, inject } from "vitest";
import type { InfrastructureHandle } from "@heat/db/testing";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/app.setup";

declare module "vitest" {
  export interface ProvidedContext {
    infrastructure: InfrastructureHandle;
  }
}

export const TEST_DATABASE = Symbol("TEST_DATABASE");
export const TEST_REDIS_URL = Symbol("TEST_REDIS_URL");

export interface TestApp {
  app: INestApplication;
  moduleRef: TestingModule;
  database: TestDatabase;
  factories: Factories;
  redisUrl: string;
  baseUrl: string;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  imports?: ModuleMetadata["imports"];
  providers?: ModuleMetadata["providers"];
  controllers?: ModuleMetadata["controllers"];
}

export const createTestApp = async (options: TestAppOptions = {}): Promise<TestApp> => {
  const { postgresUrl, redisUrl, templateName } = inject("infrastructure");
  const database = await cloneDatabase(postgresUrl, templateName);

  @Global()
  @Module({
    providers: [
      { provide: TEST_DATABASE, useValue: database.prisma },
      { provide: TEST_REDIS_URL, useValue: redisUrl },
    ],
    exports: [TEST_DATABASE, TEST_REDIS_URL],
  })
  class TestInfrastructureModule {}

  const previous = { DATABASE_URL: process.env.DATABASE_URL, REDIS_URL: process.env.REDIS_URL };
  process.env.DATABASE_URL = database.url;
  process.env.REDIS_URL = redisUrl;

  try {
    const moduleRef = await Test.createTestingModule({
      imports: [TestInfrastructureModule, AppModule, ...(options.imports ?? [])],
      providers: options.providers,
      controllers: options.controllers,
    }).compile();
    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);

    return {
      app,
      moduleRef,
      database,
      factories: createFactories(database.prisma),
      redisUrl,
      baseUrl: await app.getUrl(),
      close: async () => {
        await app.close();
        await database.close();
        restoreEnvironment(previous);
      },
    };
  } catch (error) {
    await database.close();
    restoreEnvironment(previous);
    throw error;
  }
};

const restoreEnvironment = (previous: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

export const useTestApp = (options: TestAppOptions = {}): (() => TestApp) => {
  let current: TestApp | undefined;

  beforeEach(async () => {
    current = await createTestApp(options);
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  return () => {
    if (!current) {
      throw new Error("useTestApp can only be read inside a test or a hook");
    }
    return current;
  };
};
