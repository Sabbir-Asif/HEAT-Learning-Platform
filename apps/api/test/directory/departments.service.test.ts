import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { DepartmentsService } from "../../src/directory/departments.service";
import { ApiException } from "../../src/http/api-exception";

const id = "0198f1a0-0000-7000-8000-0000000000d1";
const dhaka = "0198f1a0-0000-7000-8000-0000000000a1";
const buet = "0198f1a0-0000-7000-8000-0000000000a2";
const arts = "0198f1a0-0000-7000-8000-0000000000b1";
const science = "0198f1a0-0000-7000-8000-0000000000b2";
const at = new Date("2026-11-10T06:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id,
  name: "Bengali",
  archivedAt: null,
  createdAt: at,
  updatedAt: at,
  universityFaculty: {
    university: { id: dhaka, name: "University of Dhaka" },
    faculty: { id: arts, name: "Faculty of Arts" },
  },
  ...overrides,
});

const uniqueViolation = Object.assign(new Error("unique"), { code: "P2002" });
const foreignKeyViolation = Object.assign(new Error("fk"), { code: "P2003" });

const build = (
  options: {
    existing?: ReturnType<typeof row> | null;
    taken?: { id: string } | null;
    students?: number;
    linked?: boolean;
    createError?: Error;
    updateError?: Error;
    deleteError?: Error;
  } = {},
) => {
  const students = options.students ?? 0;
  const includingDeleted = {
    studentProfile: { count: vi.fn().mockResolvedValue(students) },
    department: {
      findMany: vi.fn().mockResolvedValue([{ id, _count: { profiles: students } }]),
    },
  };
  const database = {
    department: {
      findMany: vi.fn().mockResolvedValue([row()]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi
        .fn()
        .mockResolvedValue(options.existing === undefined ? row() : options.existing),
      findFirst: vi.fn().mockResolvedValue(options.taken ?? null),
      create: options.createError
        ? vi.fn().mockRejectedValue(options.createError)
        : vi.fn().mockResolvedValue(row()),
      update: options.updateError
        ? vi.fn().mockRejectedValue(options.updateError)
        : vi.fn().mockResolvedValue(
            row({
              name: "History",
              universityFaculty: {
                university: { id: buet, name: "BUET" },
                faculty: { id: science, name: "Faculty of Science" },
              },
            }),
          ),
      delete: options.deleteError
        ? vi.fn().mockRejectedValue(options.deleteError)
        : vi.fn().mockResolvedValue(row()),
    },
    universityFaculty: {
      findUnique: vi
        .fn()
        .mockResolvedValue(options.linked === false ? null : { universityId: dhaka }),
    },
    $includingDeleted: () => includingDeleted,
  };
  const service = new DepartmentsService(database as never, new AuditService({} as never));
  const changes: AuditChange[] = [];
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> =>
    auditScopeStorage.run({ tx: database as never, changes }, run);
  return { service, database, includingDeleted, changes, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

const code = async (promise: Promise<unknown>): Promise<string | undefined> => {
  const error = await failureOf(promise);
  if (error === undefined) return undefined;
  return error instanceof ApiException ? error.code : "OTHER";
};

const input = { name: "Bengali", universityId: dhaka, facultyId: arts };

const pairInclude = {
  universityFaculty: {
    select: {
      university: { select: { id: true, name: true } },
      faculty: { select: { id: true, name: true } },
    },
  },
};

describe("DepartmentsService.list", () => {
  test("pages, sorts, searches and filters by university and faculty", async () => {
    const { service, database } = build({ students: 3 });

    const result = await service.list({
      page: 2,
      pageSize: 10,
      sort: "-name",
      q: "ben",
      universityId: dhaka,
      facultyId: arts,
    });

    const where = {
      name: { contains: "ben", mode: "insensitive" },
      universityId: dhaka,
      facultyId: arts,
    };
    expect(database.department.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ name: "desc" }, { id: "asc" }],
      skip: 10,
      take: 10,
      include: pairInclude,
    });
    expect(database.department.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      items: [
        {
          id,
          name: "Bengali",
          university: { id: dhaka, name: "University of Dhaka" },
          faculty: { id: arts, name: "Faculty of Arts" },
          archivedAt: null,
          createdAt: at.toISOString(),
          updatedAt: at.toISOString(),
          studentCount: 3,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  test("applies no filter and sorts by name when none is given", async () => {
    const { service, database } = build();

    await service.list({ page: 1, pageSize: 25 });

    expect(database.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    );
  });

  test.each([
    ["createdAt", { createdAt: "asc" }],
    ["-createdAt", { createdAt: "desc" }],
  ] as const)("sorts by %s", async (sort, expected) => {
    const { service, database } = build();

    await service.list({ page: 1, pageSize: 25, sort });

    expect(database.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [expected, { id: "asc" }] }),
    );
  });

  test("counts the students of the whole page with one query, soft-deleted profiles included", async () => {
    const { service, includingDeleted } = build({ students: 2 });

    await service.list({ page: 1, pageSize: 25 });

    expect(includingDeleted.department.findMany).toHaveBeenCalledTimes(1);
    expect(includingDeleted.department.findMany).toHaveBeenCalledWith({
      where: { id: { in: [id] } },
      select: { id: true, _count: { select: { profiles: true } } },
    });
    expect(includingDeleted.studentProfile.count).not.toHaveBeenCalled();
  });

  test("an empty page makes no usage query", async () => {
    const { service, database, includingDeleted } = build();
    database.department.findMany.mockResolvedValue([]);

    const result = await service.list({ page: 1, pageSize: 25 });

    expect(result.items).toEqual([]);
    expect(includingDeleted.department.findMany).not.toHaveBeenCalled();
  });
});

describe("DepartmentsService.get", () => {
  test("returns the department with its pair and student count", async () => {
    const { service } = build({ students: 2 });

    expect(await service.get(id)).toMatchObject({
      id,
      studentCount: 2,
      university: { id: dhaka },
      faculty: { id: arts },
    });
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service } = build({ existing: null });

    expect(await code(service.get(id))).toBe("NOT_FOUND");
  });
});

describe("DepartmentsService.create", () => {
  test("writes the department under the linked pair and captures the new values", async () => {
    const { service, database, changes, inAuditScope } = build();

    const created = await inAuditScope(() => service.create(input));

    expect(database.universityFaculty.findUnique).toHaveBeenCalledWith({
      where: { universityId_facultyId: { universityId: dhaka, facultyId: arts } },
      select: { universityId: true },
    });
    expect(database.department.create).toHaveBeenCalledWith({
      data: { name: "Bengali", universityId: dhaka, facultyId: arts },
      include: pairInclude,
    });
    expect(created).toMatchObject({ id, studentCount: 0 });
    expect(changes).toEqual([
      {
        entityId: id,
        after: {
          name: "Bengali",
          universityId: dhaka,
          universityName: "University of Dhaka",
          facultyId: arts,
          facultyName: "Faculty of Arts",
        },
      },
    ]);
  });

  test("a faculty the university does not offer is VALIDATION_FAILED and nothing is written", async () => {
    const { service, database, changes, inAuditScope } = build({ linked: false });

    const failure = await failureOf(inAuditScope(() => service.create(input)));

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("VALIDATION_FAILED");
    expect((failure as ApiException).getStatus()).toBe(400);
    expect(database.department.create).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("a name held under the same pair, compared without case, is DIRECTORY_NAME_TAKEN", async () => {
    const { service, database, changes, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.create({ ...input, name: "bengali" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );

    expect(database.department.findFirst).toHaveBeenCalledWith({
      where: {
        universityId: dhaka,
        facultyId: arts,
        name: { equals: "bengali", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(database.department.create).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("a unique violation from a concurrent create is DIRECTORY_NAME_TAKEN", async () => {
    const { service, inAuditScope } = build({ createError: uniqueViolation });

    expect(await code(inAuditScope(() => service.create(input)))).toBe("DIRECTORY_NAME_TAKEN");
  });

  test("a link removed after the check is NOT_FOUND, not a failed write", async () => {
    const { service, inAuditScope } = build({ createError: foreignKeyViolation });

    expect(await code(inAuditScope(() => service.create(input)))).toBe("NOT_FOUND");
  });

  test("any other database error is not hidden", async () => {
    const { service, inAuditScope } = build({ createError: new Error("down") });

    expect(await code(inAuditScope(() => service.create(input)))).toBe("OTHER");
  });
});

describe("DepartmentsService.update", () => {
  test("renames within the same pair without a link or student check and captures before and after", async () => {
    const { service, database, includingDeleted, changes, inAuditScope } = build({
      students: 5,
    });

    await inAuditScope(() => service.update(id, { ...input, name: "History" }));

    expect(database.department.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "History", universityId: dhaka, facultyId: arts },
      include: pairInclude,
    });
    expect(includingDeleted.studentProfile.count).toHaveBeenCalledTimes(1);
    expect(database.universityFaculty.findUnique).not.toHaveBeenCalled();
    expect(changes).toEqual([
      {
        entityId: id,
        before: {
          name: "Bengali",
          universityId: dhaka,
          universityName: "University of Dhaka",
          facultyId: arts,
          facultyName: "Faculty of Arts",
        },
        after: {
          name: "History",
          universityId: buet,
          universityName: "BUET",
          facultyId: science,
          facultyName: "Faculty of Science",
        },
      },
    ]);
  });

  test("the name check covers the target pair and excludes the department itself", async () => {
    const { service, database, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.update(id, input)))).toBe("DIRECTORY_NAME_TAKEN");

    expect(database.department.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: id },
        universityId: dhaka,
        facultyId: arts,
        name: { equals: "Bengali", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(database.department.update).not.toHaveBeenCalled();
  });

  test("moving an unreferenced department to another linked pair is allowed", async () => {
    const { service, database, inAuditScope } = build({ students: 0 });

    await inAuditScope(() =>
      service.update(id, { name: "Bengali", universityId: buet, facultyId: science }),
    );

    expect(database.universityFaculty.findUnique).toHaveBeenCalledWith({
      where: { universityId_facultyId: { universityId: buet, facultyId: science } },
      select: { universityId: true },
    });
    expect(database.department.update).toHaveBeenCalled();
  });

  test("moving a department that students reference is DIRECTORY_IN_USE with the count, soft-deleted included", async () => {
    const { service, database, includingDeleted, changes, inAuditScope } = build({ students: 3 });

    const failure = await failureOf(
      inAuditScope(() =>
        service.update(id, { name: "Bengali", universityId: buet, facultyId: science }),
      ),
    );

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
    expect((failure as ApiException).detail).toContain("3 students");
    expect(includingDeleted.studentProfile.count).toHaveBeenCalledWith({
      where: { departmentId: id },
    });
    expect(database.department.update).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("moving to a pair that is not linked is VALIDATION_FAILED", async () => {
    const { service, database, inAuditScope } = build({ linked: false });

    expect(
      await code(
        inAuditScope(() =>
          service.update(id, { name: "Bengali", universityId: buet, facultyId: arts }),
        ),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(database.department.update).not.toHaveBeenCalled();
  });

  test("a unique violation from a concurrent rename is DIRECTORY_NAME_TAKEN", async () => {
    const { service, inAuditScope } = build({ updateError: uniqueViolation });

    expect(await code(inAuditScope(() => service.update(id, input)))).toBe("DIRECTORY_NAME_TAKEN");
  });

  test("a link removed after the check is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ updateError: foreignKeyViolation });

    expect(await code(inAuditScope(() => service.update(id, input)))).toBe("NOT_FOUND");
  });

  test("a department deleted meanwhile is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({
      updateError: Object.assign(new Error("gone"), { code: "P2025" }),
    });

    expect(await code(inAuditScope(() => service.update(id, input)))).toBe("NOT_FOUND");
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ existing: null });

    expect(await code(inAuditScope(() => service.update(id, input)))).toBe("NOT_FOUND");
  });
});

describe("DepartmentsService.remove", () => {
  test("deletes an unreferenced department and captures what was removed", async () => {
    const { service, database, changes, inAuditScope } = build();

    await inAuditScope(() => service.remove(id));

    expect(database.department.delete).toHaveBeenCalledWith({ where: { id } });
    expect(changes).toEqual([
      {
        entityId: id,
        before: {
          name: "Bengali",
          universityId: dhaka,
          universityName: "University of Dhaka",
          facultyId: arts,
          facultyName: "Faculty of Arts",
        },
      },
    ]);
  });

  test("students referencing it, soft-deleted included, refuse the delete with DIRECTORY_IN_USE", async () => {
    const { service, database, includingDeleted, changes, inAuditScope } = build({ students: 2 });

    const failure = await failureOf(inAuditScope(() => service.remove(id)));

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
    expect((failure as ApiException).detail).toBe(
      "This department is used by 2 students, so it cannot be deleted.",
    );
    expect(includingDeleted.studentProfile.count).toHaveBeenCalledWith({
      where: { departmentId: id },
    });
    expect(database.department.delete).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("a foreign key violation from a late reference is DIRECTORY_IN_USE, read on the database not the aborted transaction", async () => {
    const { service, database, includingDeleted, inAuditScope } = build({
      deleteError: foreignKeyViolation,
    });
    includingDeleted.studentProfile.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const failure = await failureOf(inAuditScope(() => service.remove(id)));

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
    expect((failure as ApiException).detail).toContain("1 student");
    expect(database.department.delete).toHaveBeenCalledTimes(1);
  });

  test("a foreign key violation with no student left still refuses with DIRECTORY_IN_USE", async () => {
    const { service, inAuditScope } = build({ deleteError: foreignKeyViolation });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("DIRECTORY_IN_USE");
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ existing: null });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("NOT_FOUND");
  });

  test("a department deleted meanwhile is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({
      deleteError: Object.assign(new Error("gone"), { code: "P2025" }),
    });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("NOT_FOUND");
  });
});
