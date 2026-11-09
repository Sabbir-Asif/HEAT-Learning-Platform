import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { createMigratedTemplate } from "./database";

export interface Infrastructure {
  postgresUrl: string;
  redisUrl: string;
  templateName: string;
  stop: () => Promise<void>;
}

export const startInfrastructure = async (): Promise<Infrastructure> => {
  const [postgres, redis] = await Promise.all([
    new PostgreSqlContainer("postgres:17-alpine").start(),
    new RedisContainer("redis:7-alpine").start(),
  ]);
  const postgresUrl = postgres.getConnectionUri();
  try {
    const templateName = await createMigratedTemplate(postgresUrl);
    return {
      postgresUrl,
      redisUrl: redis.getConnectionUrl(),
      templateName,
      stop: async () => {
        await Promise.all([postgres.stop(), redis.stop()]);
      },
    };
  } catch (error) {
    await Promise.all([postgres.stop(), redis.stop()]);
    throw error;
  }
};

export interface InfrastructureHandle {
  postgresUrl: string;
  redisUrl: string;
  templateName: string;
}

export interface ProvideTarget {
  provide: (key: "infrastructure", value: InfrastructureHandle) => void;
}

export const provideInfrastructure = async (
  project: ProvideTarget,
): Promise<() => Promise<void>> => {
  const infrastructure = await startInfrastructure();
  project.provide("infrastructure", {
    postgresUrl: infrastructure.postgresUrl,
    redisUrl: infrastructure.redisUrl,
    templateName: infrastructure.templateName,
  });
  return infrastructure.stop;
};
