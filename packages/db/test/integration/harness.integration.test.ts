import { afterAll, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

const opened: TestDatabase[] = [];

afterAll(async () => {
  await Promise.all(opened.map((database) => database.close()));
});

test("each call gets its own database", async () => {
  const first = await withDatabase();
  const second = await withDatabase();
  opened.push(first, second);

  await first.query("create table isolation_probe (id int)");

  const inFirst = await first.query("select to_regclass('isolation_probe') as found");
  const inSecond = await second.query("select to_regclass('isolation_probe') as found");

  expect(first.url).not.toBe(second.url);
  expect(inFirst.rows[0]).toEqual({ found: "isolation_probe" });
  expect(inSecond.rows[0]).toEqual({ found: null });
});

test("the database runs Postgres 17", async () => {
  const database = await withDatabase();
  opened.push(database);

  const result = await database.query("show server_version_num");

  expect(Number(result.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(170000);
  expect(Number(result.rows[0]?.server_version_num)).toBeLessThan(180000);
});
