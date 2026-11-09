import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { createClient, type HeatClient } from "../client";
import { PrismaClient } from "../generated/client";

const run = promisify(execFile);

const packageRoot = resolve(__dirname, "..", "..");

export interface TestDatabase {
  name: string;
  url: string;
  prisma: HeatClient;
  hardDeleting: PrismaClient;
  query: (sql: string, values?: unknown[]) => Promise<QueryResult<QueryResultRow>>;
  close: () => Promise<void>;
}

export const urlForDatabase = (url: string, name: string): string => {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
};

const newName = (prefix: string): string => `${prefix}_${randomUUID().replaceAll("-", "")}`;

const withAdmin = async <T>(url: string, action: (admin: Client) => Promise<T>): Promise<T> => {
  const admin = new Client({ connectionString: url });
  await admin.connect();
  try {
    return await action(admin);
  } finally {
    await admin.end();
  }
};

export const createMigratedTemplate = async (postgresUrl: string): Promise<string> => {
  const name = newName("template");
  await withAdmin(postgresUrl, (admin) => admin.query(`create database ${name}`));
  await run("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: urlForDatabase(postgresUrl, name) },
  });
  return name;
};

export const cloneDatabase = async (
  postgresUrl: string,
  templateName: string,
): Promise<TestDatabase> => {
  const name = newName("test");
  await withAdmin(postgresUrl, (admin) =>
    admin.query(`create database ${name} template ${templateName}`),
  );

  const url = urlForDatabase(postgresUrl, name);
  const client = new Client({ connectionString: url });
  await client.connect();
  const prisma = createClient(url);
  const hardDeleting = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  return {
    name,
    url,
    prisma,
    hardDeleting,
    query: (sql, values) => client.query(sql, values),
    close: async () => {
      await prisma.$disconnect();
      await hardDeleting.$disconnect();
      await client.end();
      await withAdmin(postgresUrl, (admin) =>
        admin.query(`drop database if exists ${name} with (force)`),
      );
    },
  };
};
