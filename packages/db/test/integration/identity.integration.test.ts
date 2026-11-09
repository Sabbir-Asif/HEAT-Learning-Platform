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
const hash = () => "a".repeat(64);

const seedDepartment = async () => {
  const university = await database.prisma.university.create({ data: { name: `U ${unique()}` } });
  const faculty = await database.prisma.faculty.create({ data: { name: `F ${unique()}` } });
  await database.prisma.universityFaculty.create({
    data: { universityId: university.id, facultyId: faculty.id },
  });
  return database.prisma.department.create({
    data: { name: "Physics", universityId: university.id, facultyId: faculty.id },
  });
};

const createStudent = () =>
  database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "STUDENT",
      realm: "STUDENT",
    },
  });

const createAdmin = () =>
  database.prisma.user.create({
    data: {
      email: `${unique()}@example.com`,
      passwordHash: "argon2id-hash",
      role: "ADMIN",
      realm: "ADMIN",
    },
  });

describe("secrets are stored only as hashes", () => {
  test("no secret-bearing table has a raw token column", async () => {
    const result = await database.query(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and table_name in ('Session', 'AuthToken', 'RecoveryCode')
         and lower(column_name) in ('token', 'refreshtoken', 'code', 'secret')`,
    );

    expect(result.rows).toEqual([]);
  });

  test("each secret-bearing table has a hash column", async () => {
    const result = await database.query(
      `select table_name, column_name from information_schema.columns
       where table_schema = 'public'
         and column_name in ('refreshTokenHash', 'tokenHash', 'codeHash')
       order by table_name`,
    );

    expect(result.rows).toEqual([
      { table_name: "AuthToken", column_name: "tokenHash" },
      { table_name: "RecoveryCode", column_name: "codeHash" },
      { table_name: "Session", column_name: "refreshTokenHash" },
    ]);
  });

  test("a session rejects a refresh token hash that is not 64 hex characters", async () => {
    const user = await createStudent();

    await expect(
      database.prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: "raw-refresh-token",
          familyId: crypto.randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow(/Session_refreshTokenHash_sha256_check/);
  });

  test("an auth token rejects a token hash that is not 64 hex characters", async () => {
    const user = await createStudent();

    await expect(
      database.prisma.authToken.create({
        data: {
          userId: user.id,
          purpose: "VERIFY_EMAIL",
          tokenHash: "A".repeat(64),
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow(/AuthToken_tokenHash_sha256_check/);
  });

  test("a recovery code rejects a hash that is not 64 hex characters", async () => {
    const admin = await createAdmin();

    await expect(
      database.prisma.recoveryCode.create({ data: { userId: admin.id, codeHash: "123456" } }),
    ).rejects.toThrow(/RecoveryCode_codeHash_sha256_check/);
  });

  test("hashes of the right shape are accepted", async () => {
    const user = await createStudent();

    const token = await database.prisma.authToken.create({
      data: {
        userId: user.id,
        purpose: "VERIFY_EMAIL",
        tokenHash: hash(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    expect(token.tokenHash).toBe(hash());
  });

  test("two sessions cannot share a refresh token hash", async () => {
    const user = await createStudent();
    const data = {
      userId: user.id,
      refreshTokenHash: "b".repeat(64),
      familyId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    await database.prisma.session.create({ data });

    await expect(database.prisma.session.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});

describe("user realm follows role", () => {
  test("a student cannot be placed in the admin realm", async () => {
    await expect(
      database.prisma.user.create({
        data: {
          email: `${unique()}@example.com`,
          passwordHash: "x",
          role: "STUDENT",
          realm: "ADMIN",
        },
      }),
    ).rejects.toThrow(/User_realm_matches_role_check/);
  });

  test("an admin cannot be placed in the student realm", async () => {
    await expect(
      database.prisma.user.create({
        data: {
          email: `${unique()}@example.com`,
          passwordHash: "x",
          role: "ADMIN",
          realm: "STUDENT",
        },
      }),
    ).rejects.toThrow(/User_realm_matches_role_check/);
  });

  test("a super admin belongs to the admin realm", async () => {
    const user = await database.prisma.user.create({
      data: {
        email: `${unique()}@example.com`,
        passwordHash: "x",
        role: "SUPER_ADMIN",
        realm: "ADMIN",
      },
    });

    expect(user.realm).toBe("ADMIN");
  });
});

describe("student profile", () => {
  test("a user has at most one profile", async () => {
    const department = await seedDepartment();
    const user = await createStudent();
    const data = {
      userId: user.id,
      name: "Ayesha Rahman",
      departmentId: department.id,
      session: "2020-21",
    };
    await database.prisma.studentProfile.create({ data });

    await expect(database.prisma.studentProfile.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("a profile needs an existing department", async () => {
    const user = await createStudent();

    await expect(
      database.prisma.studentProfile.create({
        data: {
          userId: user.id,
          name: "Ayesha Rahman",
          departmentId: crypto.randomUUID(),
          session: "2020-21",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("a department with a student profile cannot be hard deleted", async () => {
    const department = await seedDepartment();
    const user = await createStudent();
    await database.prisma.studentProfile.create({
      data: {
        userId: user.id,
        name: "Ayesha Rahman",
        departmentId: department.id,
        session: "2020-21",
      },
    });

    await expect(
      database.prisma.department.delete({ where: { id: department.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("admin credentials", () => {
  test("an admin has at most one credential row", async () => {
    const admin = await createAdmin();
    const data = { userId: admin.id, totpSecretEncrypted: Buffer.from("ciphertext") };
    await database.prisma.adminCredential.create({ data });

    await expect(database.prisma.adminCredential.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("the same recovery code hash cannot be stored twice for one admin", async () => {
    const admin = await createAdmin();
    const data = { userId: admin.id, codeHash: "c".repeat(64) };
    await database.prisma.recoveryCode.create({ data });

    await expect(database.prisma.recoveryCode.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});

describe("admin-only rows belong to admins", () => {
  test("a student cannot have an authenticator credential", async () => {
    const student = await createStudent();

    await expect(
      database.prisma.adminCredential.create({
        data: { userId: student.id, totpSecretEncrypted: Buffer.from("ciphertext") },
      }),
    ).rejects.toThrow(/admin/i);
  });

  test("a student cannot have recovery codes", async () => {
    const student = await createStudent();

    await expect(
      database.prisma.recoveryCode.create({ data: { userId: student.id, codeHash: hash() } }),
    ).rejects.toThrow(/admin/i);
  });

  test("a student cannot decide a profile change request", async () => {
    const student = await createStudent();
    const other = await createStudent();

    await expect(
      database.prisma.profileChangeRequest.create({
        data: { userId: student.id, requestedName: "A. Rahman", decidedById: other.id },
      }),
    ).rejects.toThrow(/admin/i);
  });
});

describe("profile change requests", () => {
  test("a request starts pending and records who decides it", async () => {
    const department = await seedDepartment();
    const student = await createStudent();
    const admin = await createAdmin();

    const request = await database.prisma.profileChangeRequest.create({
      data: {
        userId: student.id,
        requestedName: "Ayesha R.",
        requestedDepartmentId: department.id,
      },
    });
    const decided = await database.prisma.profileChangeRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", decidedById: admin.id, decidedAt: new Date() },
    });

    expect(request.status).toBe("PENDING");
    expect(decided.decidedById).toBe(admin.id);
  });
});
