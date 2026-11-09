import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

let database: TestDatabase;
let appClient: Client;

beforeAll(async () => {
  database = await withDatabase();
  appClient = new Client({ connectionString: database.url });
  await appClient.connect();
  await appClient.query("set role heat_app");
});

afterAll(async () => {
  await appClient.end();
  await database.close();
});

const insertAsApp = async () => {
  const result = await appClient.query(
    `insert into "AuditLog" ("id", "action", "entity", "before", "after", "requestId", "ipAddress")
     values (gen_random_uuid(), 'course.update', 'Course', '{"title":"A"}', '{"title":"B"}', 'req-1', '203.0.113.7')
     returning "id"`,
  );
  return result.rows[0].id as string;
};

describe("audit log rows", () => {
  test("an entry records what changed, who asked and when", async () => {
    const actor = await database.prisma.user.create({
      data: {
        email: `${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash: "argon2id-hash",
        role: "ADMIN",
        realm: "ADMIN",
      },
    });

    const entry = await database.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "course.update",
        entity: "Course",
        entityId: "abc",
        before: { title: "A" },
        after: { title: "B" },
        requestId: "req-1",
        ipAddress: "203.0.113.7",
      },
    });

    expect(entry.occurredAt).toBeInstanceOf(Date);
    expect(entry).toMatchObject({ before: { title: "A" }, after: { title: "B" } });
  });

  test("an entry survives the permanent deletion of its actor", async () => {
    const actor = await database.prisma.user.create({
      data: {
        email: `${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash: "argon2id-hash",
        role: "ADMIN",
        realm: "ADMIN",
      },
    });
    const entry = await database.prisma.auditLog.create({
      data: { actorId: actor.id, action: "admin.sign-in", entity: "User" },
    });

    await database.hardDeleting.user.delete({ where: { id: actor.id } });

    expect(await database.prisma.auditLog.findUnique({ where: { id: entry.id } })).not.toBeNull();
  });
});

describe("the application database role", () => {
  test("can insert and read audit entries", async () => {
    const id = await insertAsApp();

    const result = await appClient.query('select "action" from "AuditLog" where "id" = $1', [id]);

    expect(result.rows[0].action).toBe("course.update");
  });

  test("is denied UPDATE", async () => {
    const id = await insertAsApp();

    await expect(
      appClient.query(`update "AuditLog" set "action" = 'tampered' where "id" = $1`, [id]),
    ).rejects.toThrow(/permission denied for table AuditLog/);
  });

  test("is denied DELETE", async () => {
    const id = await insertAsApp();

    await expect(appClient.query('delete from "AuditLog" where "id" = $1', [id])).rejects.toThrow(
      /permission denied for table AuditLog/,
    );
  });

  test("is denied TRUNCATE", async () => {
    await expect(appClient.query('truncate "AuditLog"')).rejects.toThrow(
      /permission denied for table AuditLog/,
    );
  });

  test("leaves the entry unchanged after the denied attempts", async () => {
    const id = await insertAsApp();
    await appClient
      .query(`update "AuditLog" set "action" = 'tampered' where "id" = $1`, [id])
      .catch(() => undefined);

    const result = await appClient.query('select "action" from "AuditLog" where "id" = $1', [id]);

    expect(result.rows[0].action).toBe("course.update");
  });

  test("does not own the table, so it cannot lift the restriction itself", async () => {
    const owner = await database.query(
      `select tableowner from pg_tables where tablename = 'AuditLog'`,
    );

    expect(owner.rows[0]?.tableowner).not.toBe("heat_app");
    await appClient.query('grant update on "AuditLog" to heat_app');
    await expect(appClient.query(`update "AuditLog" set "action" = 'x'`)).rejects.toThrow(
      /permission denied for table AuditLog/,
    );
  });
});

describe("the table owner", () => {
  const insertAsOwner = async () => {
    const result = await database.query(
      `insert into "AuditLog" ("id", "action", "entity") values (gen_random_uuid(), 'x', 'Course') returning "id"`,
    );
    return result.rows[0]!.id as string;
  };

  test("is the role that migrated the database and is not heat_app", async () => {
    const owner = await database.query(
      `select tableowner = current_user as owned from pg_tables where tablename = 'AuditLog'`,
    );

    expect(owner.rows[0]?.owned).toBe(true);
  });

  test("cannot UPDATE an entry", async () => {
    const id = await insertAsOwner();

    await expect(
      database.query(`update "AuditLog" set "action" = 'tampered' where "id" = $1`, [id]),
    ).rejects.toThrow(/append-only/);
  });

  test("cannot DELETE an entry", async () => {
    const id = await insertAsOwner();

    await expect(database.query('delete from "AuditLog" where "id" = $1', [id])).rejects.toThrow(
      /append-only/,
    );
  });

  test("cannot TRUNCATE the table", async () => {
    await insertAsOwner();

    await expect(database.query('truncate "AuditLog"')).rejects.toThrow(/append-only/);
  });

  test("can still insert and read entries, and the entry is unchanged afterwards", async () => {
    const id = await insertAsOwner();
    await database
      .query(`update "AuditLog" set "action" = 'tampered' where "id" = $1`, [id])
      .catch(() => undefined);

    const result = await database.query('select "action" from "AuditLog" where "id" = $1', [id]);

    expect(result.rows[0]!.action).toBe("x");
  });
});
