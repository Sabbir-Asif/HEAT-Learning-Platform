import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { UniversitiesService } from "../../src/directory/universities.service";
import { ApiException } from "../../src/http/api-exception";

const id = "0198f1a0-0000-7000-8000-000000000001";
const at = new Date("2026-11-10T06:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id,
  name: "University of Dhaka",
  archivedAt: null,
  createdAt: at,
  updatedAt: at,
  ...overrides,
});

interface Counts {
  students?: number;
  departments?: number;
  faculties?: number;
}

const uniqueViolation = Object.assign(new Error("unique"), { code: "P2002" });
const foreignKeyViolation = Object.assign(new Error("fk"), { code: "P2003" });

const build = (
  options: {
    existing?: ReturnType<typeof row> | null;
    taken?: { id: string } | null;
    counts?: Counts;
    createError?: Error;
    updateError?: Error;
    deleteError?: Error;
  } = {},
) => {
  const counts = options.counts ?? {};
  const includingDeleted = {
    studentProfile: { count: vi.fn().mockResolvedValue(counts.students ?? 0) },
  };
  const database = {
    university: {
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
        : vi.fn().mockResolvedValue(row({ name: "Dhaka University" })),
      delete: options.deleteError
        ? vi.fn().mockRejectedValue(options.deleteError)
        : vi.fn().mockResolvedValue(row()),
    },
    department: { count: vi.fn().mockResolvedValue(counts.departments ?? 0) },
    universityFaculty: { count: vi.fn().mockResolvedValue(counts.faculties ?? 0) },
    $includingDeleted: () => includingDeleted,
  };
  const service = new UniversitiesService(database as never, new AuditService({} as never));
  const changes: AuditChange[] = [];
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> =>
    auditScopeStorage.run({ tx: database as never, changes }, run);
  return { service, database, includingDeleted, changes, inAuditScope };
};

const code = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiException ? error.code : "OTHER"),
  );

describe("UniversitiesService.list", () => {
  test("pages, sorts and searches by name and reports usage counts", async () => {
    const { service, database } = build({ counts: { students: 4, departments: 2, faculties: 1 } });

    const result = await service.list({ page: 2, pageSize: 10, sort: "-name", q: "dha" });

    expect(database.university.findMany).toHaveBeenCalledWith({
      where: { name: { contains: "dha", mode: "insensitive" } },
      orderBy: [{ name: "desc" }, { id: "asc" }],
      skip: 10,
      take: 10,
    });
    expect(database.university.count).toHaveBeenCalledWith({
      where: { name: { contains: "dha", mode: "insensitive" } },
    });
    expect(result).toEqual({
      items: [
        {
          id,
          name: "University of Dhaka",
          archivedAt: null,
          createdAt: at.toISOString(),
          updatedAt: at.toISOString(),
          studentCount: 4,
          departmentCount: 2,
          facultyCount: 1,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  test("sorts by name ascending when no sort is given", async () => {
    const { service, database } = build();

    await service.list({ page: 1, pageSize: 25 });

    expect(database.university.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    );
  });

  test("counts students through the client that includes soft-deleted profiles", async () => {
    const { service, includingDeleted } = build({ counts: { students: 1 } });

    await service.list({ page: 1, pageSize: 25 });

    expect(includingDeleted.studentProfile.count).toHaveBeenCalledWith({
      where: { department: { universityId: id } },
    });
  });
});

describe("UniversitiesService.get", () => {
  test("returns the university with its usage", async () => {
    const { service } = build({ counts: { students: 2 } });

    expect(await service.get(id)).toMatchObject({ id, studentCount: 2 });
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service } = build({ existing: null });

    expect(await code(service.get(id))).toBe("NOT_FOUND");
  });
});

describe("UniversitiesService.create", () => {
  test("writes the university and captures the new values for the audit entry", async () => {
    const { service, database, changes, inAuditScope } = build();

    const created = await inAuditScope(() => service.create({ name: "University of Dhaka" }));

    expect(database.university.create).toHaveBeenCalledWith({
      data: { name: "University of Dhaka" },
    });
    expect(created.id).toBe(id);
    expect(changes).toEqual([{ entityId: id, after: { name: "University of Dhaka" } }]);
  });

  test("a name used by another university, compared without case, is DIRECTORY_NAME_TAKEN and nothing is written", async () => {
    const { service, database, changes, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.create({ name: "university of dhaka" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );

    expect(database.university.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "university of dhaka", mode: "insensitive" } },
      select: { id: true },
    });
    expect(database.university.create).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("a unique violation from a concurrent create is DIRECTORY_NAME_TAKEN", async () => {
    const { service, inAuditScope } = build({ createError: uniqueViolation });

    expect(await code(inAuditScope(() => service.create({ name: "A" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );
  });

  test("any other database error is not hidden", async () => {
    const { service, inAuditScope } = build({ createError: new Error("down") });

    expect(await code(inAuditScope(() => service.create({ name: "A" })))).toBe("OTHER");
  });
});

describe("UniversitiesService.update", () => {
  test("renames and captures the old and new name", async () => {
    const { service, database, changes, inAuditScope } = build();

    const updated = await inAuditScope(() => service.update(id, { name: "Dhaka University" }));

    expect(database.university.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "Dhaka University" },
    });
    expect(updated.name).toBe("Dhaka University");
    expect(changes).toEqual([
      {
        entityId: id,
        before: { name: "University of Dhaka" },
        after: { name: "Dhaka University" },
      },
    ]);
  });

  test("renaming to a name another university holds is DIRECTORY_NAME_TAKEN and the check excludes itself", async () => {
    const { service, database, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.update(id, { name: "BUET" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );

    expect(database.university.findFirst).toHaveBeenCalledWith({
      where: { id: { not: id }, name: { equals: "BUET", mode: "insensitive" } },
      select: { id: true },
    });
    expect(database.university.update).not.toHaveBeenCalled();
  });

  test("a unique violation from a concurrent rename is DIRECTORY_NAME_TAKEN", async () => {
    const { service, inAuditScope } = build({ updateError: uniqueViolation });

    expect(await code(inAuditScope(() => service.update(id, { name: "A" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ existing: null });

    expect(await code(inAuditScope(() => service.update(id, { name: "A" })))).toBe("NOT_FOUND");
  });
});

describe("UniversitiesService.remove", () => {
  test("deletes an unreferenced university and captures the removed values", async () => {
    const { service, database, changes, inAuditScope } = build();

    await inAuditScope(() => service.remove(id));

    expect(database.university.delete).toHaveBeenCalledWith({ where: { id } });
    expect(changes).toEqual([{ entityId: id, before: { name: "University of Dhaka" } }]);
  });

  test.each([
    ["student profiles", { students: 3 }, "3 students"],
    ["departments", { departments: 2 }, "2 departments"],
    ["faculty links", { faculties: 1 }, "1 faculty link"],
  ] satisfies Array<[string, Counts, string]>)(
    "refuses with DIRECTORY_IN_USE while %s reference it",
    async (_name, counts, expected) => {
      const { service, database, inAuditScope } = build({ counts });

      const failure = await inAuditScope(() => service.remove(id)).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApiException);
      expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
      expect((failure as ApiException).getStatus()).toBe(409);
      expect((failure as ApiException).detail).toContain(expected);
      expect(database.university.delete).not.toHaveBeenCalled();
    },
  );

  test("the message names every reference type and states the student count first", async () => {
    const { service, inAuditScope } = build({
      counts: { students: 1, departments: 2, faculties: 3 },
    });

    const failure = await inAuditScope(() => service.remove(id)).catch((error: unknown) => error);

    expect((failure as ApiException).detail).toBe(
      "This university is used by 1 student, 2 departments and 3 faculty links, so it cannot be deleted.",
    );
  });

  test("counts student profiles through the client that includes soft-deleted rows", async () => {
    const { service, database, includingDeleted, inAuditScope } = build({
      counts: { students: 1 },
    });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("DIRECTORY_IN_USE");

    expect(includingDeleted.studentProfile.count).toHaveBeenCalledWith({
      where: { department: { universityId: id } },
    });
    expect(database.university.delete).not.toHaveBeenCalled();
  });

  test("a foreign key violation that slips past the check is DIRECTORY_IN_USE", async () => {
    const { service, inAuditScope } = build({ deleteError: foreignKeyViolation });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("DIRECTORY_IN_USE");
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ existing: null });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("NOT_FOUND");
  });
});
