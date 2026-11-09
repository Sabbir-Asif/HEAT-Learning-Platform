import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { inject } from "vitest";
import { createClient } from "../../src/client";
import type { HeatClient } from "../../src/client";
import { PrismaClient } from "../../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const run = promisify(execFile);

export interface TestDatabase {
  url: string;
  prisma: HeatClient;
  hardDeleting: PrismaClient;
  query: (sql: string, values?: unknown[]) => Promise<QueryResult<QueryResultRow>>;
  close: () => Promise<void>;
}

const withName = (url: string, name: string): string => {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
};

export const withDatabase = async (): Promise<TestDatabase> => {
  const baseUrl = inject("postgresUrl");
  const name = `test_${randomUUID().replaceAll("-", "")}`;

  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = withName(baseUrl, name);
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
  });

  const client = new Client({ connectionString: url });
  await client.connect();

  const prisma = createClient(url);
  const hardDeleting = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  return {
    url,
    prisma,
    hardDeleting,
    query: (sql, values) => client.query(sql, values),
    close: async () => {
      await prisma.$disconnect();
      await hardDeleting.$disconnect();
      await client.end();
    },
  };
};
