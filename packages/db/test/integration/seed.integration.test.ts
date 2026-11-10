import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";
import { sampleDirectory, seed, SeedConfigError, type SeedOptions } from "../../src/seed";
import { useTestDatabase } from "./helpers";

const run = promisify(execFile);
const database = useTestDatabase();

const password = "a long seeded passphrase";

const options = (overrides: Partial<SeedOptions> = {}): SeedOptions => ({
  superAdminEmail: "Root@Example.test",
  superAdminPassword: password,
  includeSampleDirectory: false,
  production: false,
  ...overrides,
});

const counts = async () => {
  const { prisma } = database();
  return {
    users: await prisma.$includingDeleted().user.count(),
    universities: await prisma.university.count(),
    faculties: await prisma.faculty.count(),
    links: await prisma.universityFaculty.count(),
    departments: await prisma.department.count(),
    tags: await prisma.$includingDeleted().tag.count(),
  };
};

describe("seed", () => {
  test("running twice leaves the same rows", async () => {
    const { prisma } = database();
    await seed(prisma, options({ includeSampleDirectory: true }));
    const first = await counts();

    const second = await seed(prisma, options({ includeSampleDirectory: true }));

    expect(second.superAdminCreated).toBe(false);
    expect(await counts()).toEqual(first);
    expect(first).toMatchObject({
      users: 1,
      universities: 1,
      tags: 1,
      faculties: Object.keys(sampleDirectory).length,
      links: Object.keys(sampleDirectory).length,
      departments: Object.values(sampleDirectory).flat().length,
    });
  });

  test("creates the super admin as an admin-realm user who must change the password", async () => {
    const { prisma } = database();
    await seed(prisma, options());

    const user = await prisma.user.findFirstOrThrow();

    expect(user).toMatchObject({
      email: "root@example.test",
      role: "SUPER_ADMIN",
      realm: "ADMIN",
      mustChangePassword: true,
    });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(await prisma.adminCredential.count()).toBe(0);
  });

  test("stores an argon2id hash and never the password", async () => {
    const { prisma, query } = database();
    await seed(prisma, options());

    const user = await prisma.user.findFirstOrThrow();
    const stored = await query(`select to_jsonb("User")::text as row from "User"`);

    expect(user.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(stored.rows[0]?.["row"]).not.toContain(password);
  });

  test.each([
    ["email missing", { superAdminEmail: undefined }],
    ["email blank", { superAdminEmail: "   " }],
    ["password missing", { superAdminPassword: undefined }],
    ["password empty", { superAdminPassword: "" }],
  ])("%s fails with a clear message and creates nothing", async (_name, overrides) => {
    const { prisma } = database();

    await expect(seed(prisma, options(overrides))).rejects.toThrow(SeedConfigError);

    expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
  });

  test("sample data in production fails with a clear message and writes nothing", async () => {
    const { prisma } = database();

    const error = await seed(
      prisma,
      options({ production: true, includeSampleDirectory: true }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(SeedConfigError);
    expect((error as Error).message).toMatch(/SEED_SAMPLE_DIRECTORY/);
    expect(Object.values(await counts()).every((count) => count === 0)).toBe(true);
  });

  test("production without sample data seeds normally", async () => {
    const { prisma } = database();

    const summary = await seed(prisma, options({ production: true }));

    expect(summary).toEqual({ superAdminCreated: true, sampleDirectory: false });
  });

  test("the error never contains the password", async () => {
    const { prisma } = database();

    const error = await seed(prisma, options({ superAdminPassword: "short" })).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(SeedConfigError);
    expect((error as Error).message).not.toContain("short");
  });

  test("a second run does not reset the super admin password", async () => {
    const { prisma } = database();
    await seed(prisma, options());
    const before = await prisma.user.findFirstOrThrow();
    await prisma.user.update({ where: { id: before.id }, data: { mustChangePassword: false } });

    await seed(prisma, options({ superAdminPassword: "a different long passphrase" }));
    const after = await prisma.user.findFirstOrThrow();

    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.mustChangePassword).toBe(false);
  });

  test("running twice in production leaves the password hash, flag and sessions untouched", async () => {
    const { prisma } = database();
    await seed(prisma, options({ production: true }));
    const created = await prisma.user.findFirstOrThrow();
    await prisma.user.update({ where: { id: created.id }, data: { mustChangePassword: false } });
    const session = await prisma.session.create({
      data: {
        userId: created.id,
        refreshTokenHash: "a".repeat(64),
        familyId: created.id,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
    const before = await prisma.user.findFirstOrThrow();

    const second = await seed(prisma, options({ production: true }));

    expect(second.superAdminCreated).toBe(false);
    expect(await prisma.user.findFirstOrThrow()).toEqual(before);
    expect(await prisma.session.findFirstOrThrow()).toEqual(session);
  });

  test("a different configured email does not create a second super admin", async () => {
    const { prisma } = database();
    await seed(prisma, options());

    const second = await seed(prisma, options({ superAdminEmail: "other@example.test" }));

    expect(second.superAdminCreated).toBe(false);
    expect(await prisma.user.count({ where: { role: "SUPER_ADMIN" } })).toBe(1);
  });

  test("refuses an email that belongs to a non-admin user", async () => {
    const { prisma } = database();
    await prisma.user.create({
      data: { email: "root@example.test", passwordHash: "x", role: "STUDENT", realm: "STUDENT" },
    });

    await expect(seed(prisma, options())).rejects.toThrow(SeedConfigError);
  });

  test("the frontpage tag is a system tag", async () => {
    const { prisma } = database();
    await seed(prisma, options());

    const tag = await prisma.tag.findUniqueOrThrow({ where: { slug: "frontpage" } });

    expect(tag.isSystem).toBe(true);
  });

  test("restores a soft-deleted frontpage tag instead of failing or duplicating it", async () => {
    const { prisma } = database();
    await seed(prisma, options());
    await prisma.tag.delete({ where: { slug: "frontpage" } });

    await seed(prisma, options());

    const tags = await prisma.$includingDeleted().tag.findMany({ where: { slug: "frontpage" } });
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ isSystem: true, deletedAt: null });
  });

  test("production mode seeds the university without sample faculties", async () => {
    const { prisma } = database();
    await seed(prisma, options());

    expect(await counts()).toMatchObject({
      universities: 1,
      faculties: 0,
      links: 0,
      departments: 0,
    });
  });

  test("sample departments sit under linked faculties of the university", async () => {
    const { prisma } = database();
    await seed(prisma, options({ includeSampleDirectory: true }));

    const physics = await prisma.department.findFirstOrThrow({ where: { name: "Physics" } });

    expect(
      await prisma.universityFaculty.count({
        where: { universityId: physics.universityId, facultyId: physics.facultyId },
      }),
    ).toBe(1);
  });
});

describe("prisma db seed", () => {
  test("reads the environment and seeds the database", async () => {
    const result = await run("pnpm", ["exec", "prisma", "db", "seed"], {
      cwd: resolve(__dirname, "..", ".."),
      env: {
        ...process.env,
        DATABASE_URL: database().url,
        SUPER_ADMIN_EMAIL: "cli@example.test",
        SUPER_ADMIN_PASSWORD: password,
        SEED_SAMPLE_DIRECTORY: "true",
      },
    });

    expect(result.stdout).toContain("Seed complete");
    expect(result.stdout).not.toContain(password);
    expect(await database().prisma.user.count()).toBe(1);
    expect(await database().prisma.department.count()).toBeGreaterThan(0);
  });

  test("exits non-zero and creates nothing without the super admin variables", async () => {
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: database().url };
    delete env["SUPER_ADMIN_EMAIL"];
    delete env["SUPER_ADMIN_PASSWORD"];

    const failure = await run("pnpm", ["exec", "prisma", "db", "seed"], {
      cwd: resolve(__dirname, "..", ".."),
      env,
    }).catch((caught: unknown) => caught as { code: number; stdout: string; stderr: string });

    expect(failure).toMatchObject({ code: expect.any(Number) });
    expect(
      `${(failure as { stdout: string }).stdout}${(failure as { stderr: string }).stderr}`,
    ).toContain("SUPER_ADMIN_EMAIL is required");
    expect(await database().prisma.university.count()).toBe(0);
  });
});
