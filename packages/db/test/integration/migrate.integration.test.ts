import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

const run = promisify(execFile);

let database: TestDatabase;

const prisma = (args: string[]) =>
  run("pnpm", ["exec", "prisma", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: database.url },
  });

beforeAll(async () => {
  database = await withDatabase();
});

afterAll(async () => {
  await database.close();
});

test("every committed migration is applied and finished on an empty Postgres 17", async () => {
  const committed = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const applied = await database.query(
    `select migration_name, finished_at is not null as finished, rolled_back_at is null as kept
     from _prisma_migrations order by migration_name`,
  );

  expect(committed.length).toBeGreaterThanOrEqual(4);
  expect(applied.rows.map((row) => row.migration_name)).toEqual(committed);
  expect(applied.rows.every((row) => row.finished && row.kept)).toBe(true);
});

test("deploying again changes nothing", async () => {
  const { stdout } = await prisma(["migrate", "deploy"]);

  expect(stdout).toMatch(/No pending migrations/);
});

test("the migrated database matches the schema files", async () => {
  await expect(
    prisma([
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema",
      "--exit-code",
    ]),
  ).resolves.toMatchObject({ stdout: expect.stringMatching(/No difference detected/) });
});

test("a manual change to the database shows up as drift", async () => {
  await database.query('alter table "University" add column drift_probe text');

  await expect(
    prisma([
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema",
      "--exit-code",
    ]),
  ).rejects.toMatchObject({ code: 2 });
});
