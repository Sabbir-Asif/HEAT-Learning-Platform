import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { inject } from "vitest";

const run = promisify(execFile);

export interface TestDatabase {
  url: string;
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

  return {
    url,
    query: (sql, values) => client.query(sql, values),
    close: () => client.end(),
  };
};
