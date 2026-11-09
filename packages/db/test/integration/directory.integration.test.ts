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

const seedUniversity = async () => {
  const university = await database.prisma.university.create({ data: { name: `U ${unique()}` } });
  const faculty = await database.prisma.faculty.create({ data: { name: `F ${unique()}` } });
  await database.prisma.universityFaculty.create({
    data: { universityId: university.id, facultyId: faculty.id },
  });
  return { university, faculty };
};

describe("department belongs to a faculty its university offers", () => {
  test("accepts a department under a linked pair", async () => {
    const { university, faculty } = await seedUniversity();

    const department = await database.prisma.department.create({
      data: { name: "Physics", universityId: university.id, facultyId: faculty.id },
    });

    expect(department.universityId).toBe(university.id);
  });

  test("rejects a department under a faculty the university does not offer", async () => {
    const { university } = await seedUniversity();
    const other = await database.prisma.faculty.create({ data: { name: `F ${unique()}` } });

    await expect(
      database.prisma.department.create({
        data: { name: "Physics", universityId: university.id, facultyId: other.id },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("rejects two departments with one name under the same pair", async () => {
    const { university, faculty } = await seedUniversity();
    const data = { name: "Chemistry", universityId: university.id, facultyId: faculty.id };
    await database.prisma.department.create({ data });

    await expect(database.prisma.department.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
  });
});

describe("directory rows cannot be hard deleted while referenced", () => {
  test("a university with linked faculties is restricted", async () => {
    const { university } = await seedUniversity();

    await expect(
      database.prisma.university.delete({ where: { id: university.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("a faculty linked to a university is restricted", async () => {
    const { faculty } = await seedUniversity();

    await expect(
      database.prisma.faculty.delete({ where: { id: faculty.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("a university and faculty pair with departments is restricted", async () => {
    const { university, faculty } = await seedUniversity();
    await database.prisma.department.create({
      data: { name: "Law", universityId: university.id, facultyId: faculty.id },
    });

    await expect(
      database.prisma.universityFaculty.delete({
        where: {
          universityId_facultyId: { universityId: university.id, facultyId: faculty.id },
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("archiving", () => {
  test("sets archivedAt and keeps the row", async () => {
    const university = await database.prisma.university.create({ data: { name: `U ${unique()}` } });

    const archived = await database.prisma.university.update({
      where: { id: university.id },
      data: { archivedAt: new Date() },
    });

    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(await database.prisma.university.count({ where: { id: university.id } })).toBe(1);
  });
});
