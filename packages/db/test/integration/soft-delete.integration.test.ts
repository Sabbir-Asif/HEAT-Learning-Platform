import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { withDatabase, type TestDatabase } from "./helpers";

let database: TestDatabase;

beforeAll(async () => {
  database = await withDatabase();
});

afterAll(async () => {
  await database.close();
});

const unique = () => Math.random().toString(36).slice(2);

const userData = (email: string) => ({
  email,
  passwordHash: "argon2id-hash",
  role: "STUDENT" as const,
  realm: "STUDENT" as const,
});

describe("soft-deleted rows are hidden from normal queries", () => {
  test("a soft-deleted user is not returned by findMany, findFirst, findUnique or count", async () => {
    const email = `${unique()}@example.com`;
    const user = await database.prisma.user.create({ data: userData(email) });
    await database.prisma.user.delete({ where: { id: user.id } });

    expect(await database.prisma.user.findMany({ where: { email } })).toEqual([]);
    expect(await database.prisma.user.findFirst({ where: { email } })).toBeNull();
    expect(await database.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await database.prisma.user.count({ where: { email } })).toBe(0);
  });

  test("the include-deleted client returns soft-deleted rows", async () => {
    const email = `${unique()}@example.com`;
    const user = await database.prisma.user.create({ data: userData(email) });
    await database.prisma.user.delete({ where: { id: user.id } });

    const found = await database.prisma.$includingDeleted().user.findMany({ where: { email } });

    expect(found).toHaveLength(1);
    expect(found[0]?.deletedAt).toBeInstanceOf(Date);
  });

  test("updateMany does not touch soft-deleted rows", async () => {
    const email = `${unique()}@example.com`;
    const user = await database.prisma.user.create({ data: userData(email) });
    await database.prisma.user.delete({ where: { id: user.id } });

    const result = await database.prisma.user.updateMany({
      where: { email },
      data: { mustChangePassword: true },
    });

    expect(result.count).toBe(0);
  });
});

describe("delete on a soft-delete model", () => {
  test("keeps the row and sets deletedAt", async () => {
    const user = await database.prisma.user.create({
      data: userData(`${unique()}@example.com`),
    });

    const deleted = await database.prisma.user.delete({ where: { id: user.id } });

    expect(deleted.id).toBe(user.id);
    const rows = await database.query(`select "deletedAt" from "User" where id = $1`, [user.id]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]!.deletedAt).toBeInstanceOf(Date);
  });

  test("deleteMany sets deletedAt on every match and keeps the rows", async () => {
    const tag = unique();
    await database.prisma.user.create({ data: userData(`${tag}-1@example.com`) });
    await database.prisma.user.create({ data: userData(`${tag}-2@example.com`) });

    const result = await database.prisma.user.deleteMany({
      where: { email: { startsWith: tag } },
    });

    expect(result.count).toBe(2);
    const rows = await database.query(
      `select count(*)::int as n from "User" where email like $1 and "deletedAt" is not null`,
      [`${tag}%`],
    );
    expect(rows.rows[0]!.n).toBe(2);
  });

  test("the include-deleted client also soft-deletes", async () => {
    const user = await database.prisma.user.create({
      data: userData(`${unique()}@example.com`),
    });

    await database.prisma.$includingDeleted().user.delete({ where: { id: user.id } });

    const rows = await database.query(`select 1 from "User" where id = $1`, [user.id]);
    expect(rows.rows).toHaveLength(1);
  });
});

describe("delete on a model without soft delete", () => {
  test("removes the row", async () => {
    const university = await database.prisma.university.create({ data: { name: `U ${unique()}` } });

    await database.prisma.university.delete({ where: { id: university.id } });

    const rows = await database.query(`select 1 from "University" where id = $1`, [university.id]);
    expect(rows.rows).toHaveLength(0);
  });
});

describe("email uniqueness among active users", () => {
  test("a soft-deleted email can be registered again in another case", async () => {
    const old = await database.prisma.user.create({ data: userData("a1@x.bd") });
    await database.prisma.user.delete({ where: { id: old.id } });

    const next = await database.prisma.user.create({ data: userData("A1@x.bd") });

    expect(next.id).not.toBe(old.id);
  });

  test("two active users cannot share an email in different case", async () => {
    await database.prisma.user.create({ data: userData("a2@x.bd") });

    await expect(database.prisma.user.create({ data: userData("A2@x.bd") })).rejects.toThrow(
      /User_email_active_key|Unique constraint/,
    );
  });

  test("the unique index is partial on lower(email) where deletedAt is null", async () => {
    const result = await database.query(
      `select indexdef from pg_indexes where tablename = 'User' and indexname = 'User_email_active_key'`,
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.indexdef).toMatch(/UNIQUE/);
    expect(result.rows[0]!.indexdef).toMatch(/lower\(email\)/);
    expect(result.rows[0]!.indexdef).toMatch(/"deletedAt" IS NULL/);
  });
});

const createDeletedUser = async () => {
  const user = await database.prisma.user.create({ data: userData(`${unique()}@example.com`) });
  const deleted = await database.prisma.user.delete({ where: { id: user.id } });
  return { user, deletedAt: deleted.deletedAt };
};

describe("writes on soft-deleted rows through the normal client", () => {
  test("update on a deleted row fails with not found and changes nothing", async () => {
    const { user } = await createDeletedUser();

    await expect(
      database.prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } }),
    ).rejects.toMatchObject({ code: "P2025" });

    const rows = await database.query(`select "mustChangePassword" from "User" where id = $1`, [
      user.id,
    ]);
    expect(rows.rows[0]!.mustChangePassword).toBe(false);
  });

  test("setting deletedAt through update is rejected so a row cannot be resurrected", async () => {
    const { user } = await createDeletedUser();

    await expect(
      database.prisma.user.update({ where: { id: user.id }, data: { deletedAt: null } }),
    ).rejects.toThrow(/deletedAt/);
    await expect(
      database.prisma.user.updateMany({ where: { id: user.id }, data: { deletedAt: null } }),
    ).rejects.toThrow(/deletedAt/);

    const rows = await database.query(`select "deletedAt" from "User" where id = $1`, [user.id]);
    expect(rows.rows[0]!.deletedAt).toBeInstanceOf(Date);
  });

  test("a repeated delete fails with not found and keeps the original deletedAt", async () => {
    const { user, deletedAt } = await createDeletedUser();

    await expect(database.prisma.user.delete({ where: { id: user.id } })).rejects.toMatchObject({
      code: "P2025",
    });

    const stored = await database.prisma
      .$includingDeleted()
      .user.findUnique({ where: { id: user.id } });
    expect(stored?.deletedAt).toEqual(deletedAt);
  });

  test("upsert on a deleted key does not update the deleted row", async () => {
    const { user, deletedAt } = await createDeletedUser();

    await expect(
      database.prisma.user.upsert({
        where: { id: user.id },
        update: { mustChangePassword: true },
        create: { ...userData(`${unique()}@example.com`), id: user.id },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    const stored = await database.prisma
      .$includingDeleted()
      .user.findUnique({ where: { id: user.id } });
    expect(stored?.mustChangePassword).toBe(false);
    expect(stored?.deletedAt).toEqual(deletedAt);
  });

  test("upsert on an active row updates it and on a missing key creates it", async () => {
    const email = `${unique()}@example.com`;
    const created = await database.prisma.user.upsert({
      where: { id: crypto.randomUUID() },
      update: {},
      create: userData(email),
    });
    const updated = await database.prisma.user.upsert({
      where: { id: created.id },
      update: { mustChangePassword: true },
      create: userData(`${unique()}@example.com`),
    });

    expect(updated.id).toBe(created.id);
    expect(updated.mustChangePassword).toBe(true);
  });

  test("the include-deleted client can still update deleted rows", async () => {
    const { user } = await createDeletedUser();

    const updated = await database.prisma
      .$includingDeleted()
      .user.update({ where: { id: user.id }, data: { mustChangePassword: true } });

    expect(updated.mustChangePassword).toBe(true);
  });

  test("findUnique does not return a deleted row but returns an active one", async () => {
    const { user } = await createDeletedUser();
    const active = await database.prisma.user.create({
      data: userData(`${unique()}@example.com`),
    });

    expect(await database.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect((await database.prisma.user.findUnique({ where: { id: active.id } }))?.id).toBe(
      active.id,
    );
  });
});

describe("nested relations", () => {
  test("a nested include is not filtered, so services must filter relations themselves", async () => {
    const course = await database.prisma.course.create({
      data: { slug: `course-${unique()}`, title: "Gender safety" },
    });
    const revision = await database.prisma.courseRevision.create({
      data: { courseId: course.id, number: 1 },
    });
    await database.prisma.courseRevision.delete({ where: { id: revision.id } });

    const loaded = await database.prisma.course.findUnique({
      where: { id: course.id },
      include: { revisions: true },
    });
    const filtered = await database.prisma.course.findUnique({
      where: { id: course.id },
      include: { revisions: { where: { deletedAt: null } } },
    });

    expect(loaded?.revisions).toHaveLength(1);
    expect(filtered?.revisions).toHaveLength(0);
  });
});

describe("soft delete inside a transaction", () => {
  const rollback = new Error("rollback");

  test("a delete in a rolled back transaction leaves the row active", async () => {
    const user = await database.prisma.user.create({
      data: userData(`${unique()}@example.com`),
    });

    await expect(
      database.prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: user.id } });
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    const stored = await database.prisma.user.findUnique({ where: { id: user.id } });
    expect(stored?.deletedAt).toBeNull();
  });

  test("deleteMany in a rolled back transaction leaves the rows active", async () => {
    const tag = unique();
    await database.prisma.user.create({ data: userData(`${tag}-1@example.com`) });
    await database.prisma.user.create({ data: userData(`${tag}-2@example.com`) });

    await expect(
      database.prisma.$transaction(async (tx) => {
        const result = await tx.user.deleteMany({ where: { email: { startsWith: tag } } });
        expect(result.count).toBe(2);
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    expect(await database.prisma.user.count({ where: { email: { startsWith: tag } } })).toBe(2);
  });

  test("a delete in a committed transaction soft-deletes the row", async () => {
    const user = await database.prisma.user.create({
      data: userData(`${unique()}@example.com`),
    });

    await database.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: user.id } });
    });

    expect(await database.prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    const rows = await database.query(`select "deletedAt" from "User" where id = $1`, [user.id]);
    expect(rows.rows[0]!.deletedAt).toBeInstanceOf(Date);
  });

  test("a delete after an update of the same row in one transaction does not hang", async () => {
    const user = await database.prisma.user.create({
      data: userData(`${unique()}@example.com`),
    });

    await database.prisma.$transaction(
      async (tx) => {
        await tx.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
        await tx.user.delete({ where: { id: user.id } });
      },
      { timeout: 5000 },
    );

    const stored = await database.prisma
      .$includingDeleted()
      .user.findUnique({ where: { id: user.id } });
    expect(stored?.mustChangePassword).toBe(true);
    expect(stored?.deletedAt).toBeInstanceOf(Date);
  });

  test("deleteMany after an updateMany of the same rows in one transaction does not hang", async () => {
    const tag = unique();
    await database.prisma.user.create({ data: userData(`${tag}-1@example.com`) });

    await database.prisma.$transaction(
      async (tx) => {
        await tx.user.updateMany({
          where: { email: { startsWith: tag } },
          data: { mustChangePassword: true },
        });
        await tx.user.deleteMany({ where: { email: { startsWith: tag } } });
      },
      { timeout: 5000 },
    );

    expect(await database.prisma.user.count({ where: { email: { startsWith: tag } } })).toBe(0);
  });
});

describe("deletedAt in create data", () => {
  test("create, createMany and createManyAndReturn reject deletedAt", async () => {
    const data = { ...userData(`${unique()}@example.com`), deletedAt: new Date() };

    await expect(database.prisma.user.create({ data })).rejects.toThrow(/deletedAt/);
    await expect(database.prisma.user.createMany({ data: [data] })).rejects.toThrow(/deletedAt/);
    await expect(database.prisma.user.createManyAndReturn({ data: [data] })).rejects.toThrow(
      /deletedAt/,
    );
  });

  test("the include-deleted client can create a deleted row", async () => {
    const created = await database.prisma.$includingDeleted().user.create({
      data: { ...userData(`${unique()}@example.com`), deletedAt: new Date() },
    });

    expect(created.deletedAt).toBeInstanceOf(Date);
  });
});

describe("include-deleted client on a transaction client", () => {
  test("runs outside the transaction, so it cannot see rows the transaction wrote", async () => {
    await database.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: userData(`${unique()}@example.com`) });

      const outside = await tx.$includingDeleted().user.findUnique({ where: { id: user.id } });

      expect(outside).toBeNull();
    });
  });
});
