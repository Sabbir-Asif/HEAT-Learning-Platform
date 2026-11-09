import { describe, expect, test } from "vitest";
import { useTestDatabase, useTestRedis } from "./helpers";

const duplicateEmail = "same@example.test";

const insertUser = (database: ReturnType<typeof useTestDatabase>) =>
  database().prisma.user.create({
    data: {
      email: duplicateEmail,
      passwordHash: "argon2id-hash",
      role: "STUDENT",
      realm: "STUDENT",
    },
  });

describe("per-test database isolation", () => {
  const database = useTestDatabase();

  test("first test inserts a unique email", async () => {
    await insertUser(database);

    expect(await database().prisma.user.count()).toBe(1);
  });

  test("second test inserts the same email and also passes", async () => {
    await insertUser(database);

    expect(await database().prisma.user.count()).toBe(1);
  });

  test("the unique rule still holds inside one test", async () => {
    await insertUser(database);

    await expect(insertUser(database)).rejects.toMatchObject({ code: "P2002" });
  });

  test("each test starts from the migrated schema and runs Postgres 17", async () => {
    const version = await database().query("show server_version_num");
    const migrations = await database().query(
      "select count(*)::int as applied from _prisma_migrations where finished_at is not null",
    );

    expect(Number(version.rows[0]?.server_version_num)).toBeGreaterThanOrEqual(170000);
    expect(Number(version.rows[0]?.server_version_num)).toBeLessThan(180000);
    expect(migrations.rows[0]?.applied).toBeGreaterThan(0);
  });
});

describe("per-test redis isolation", () => {
  const redis = useTestRedis();

  test("first test writes a key", async () => {
    await redis().client.set("shared", "first");

    expect(await redis().client.get("shared")).toBe("first");
  });

  test("second test does not see it", async () => {
    expect(await redis().client.get("shared")).toBeNull();
  });
});
