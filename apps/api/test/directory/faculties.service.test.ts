import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { FacultiesService } from "../../src/directory/faculties.service";
import { ApiException } from "../../src/http/api-exception";

const id = "0198f1a0-0000-7000-8000-0000000000f1";
const dhaka = "0198f1a0-0000-7000-8000-0000000000a1";
const buet = "0198f1a0-0000-7000-8000-0000000000a2";
const at = new Date("2026-11-10T06:00:00.000Z");

const link = (universityId: string, name: string) => ({ university: { id: universityId, name } });

const row = (overrides: Record<string, unknown> = {}) => ({
  id,
  name: "Faculty of Arts",
  archivedAt: null,
  createdAt: at,
  updatedAt: at,
  universities: [link(dhaka, "University of Dhaka")],
  ...overrides,
});

interface Counts {
  students?: number;
  departments?: number;
  universities?: number;
}

const uniqueViolation = Object.assign(new Error("unique"), { code: "P2002" });
const foreignKeyViolation = Object.assign(new Error("fk"), { code: "P2003" });

const build = (
  options: {
    existing?: ReturnType<typeof row> | null;
    taken?: { id: string } | null;
    counts?: Counts;
    university?: { id: string; name: string; archivedAt: Date | null } | null;
    linked?: boolean;
    linkedDepartments?: string[];
    createdLinks?: number;
    createError?: Error;
    updateError?: Error;
    deleteError?: Error;
    unassignError?: Error;
    assignError?: Error;
    archivedChanged?: boolean;
  } = {},
) => {
  const counts = options.counts ?? {};
  const includingDeleted = {
    studentProfile: { count: vi.fn().mockResolvedValue(counts.students ?? 0) },
    department: {
      findMany: vi.fn().mockResolvedValue(
        Array.from({ length: counts.departments ?? 0 }, (_, index) => ({
          facultyId: id,
          _count: { profiles: index === 0 ? (counts.students ?? 0) : 0 },
        })),
      ),
    },
  };
  const database = {
    faculty: {
      findMany: vi.fn().mockResolvedValue([row()]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi
        .fn()
        .mockResolvedValue(options.existing === undefined ? row() : options.existing),
      updateMany: vi.fn().mockResolvedValue({ count: options.archivedChanged === false ? 0 : 1 }),
      findFirst: vi.fn().mockResolvedValue(options.taken ?? null),
      create: options.createError
        ? vi.fn().mockRejectedValue(options.createError)
        : vi.fn().mockResolvedValue(row({ universities: [] })),
      update: options.updateError
        ? vi.fn().mockRejectedValue(options.updateError)
        : vi.fn().mockResolvedValue(row({ name: "Faculty of Letters" })),
      delete: options.deleteError
        ? vi.fn().mockRejectedValue(options.deleteError)
        : vi.fn().mockResolvedValue(row()),
    },
    university: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.university === undefined
            ? { id: buet, name: "BUET", archivedAt: null }
            : options.university,
        ),
    },
    universityFaculty: {
      count: vi.fn().mockResolvedValue(counts.universities ?? 0),
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.linked === false ? null : { universityId: dhaka, facultyId: id },
        ),
      createMany: options.assignError
        ? vi.fn().mockRejectedValue(options.assignError)
        : vi.fn().mockResolvedValue({ count: options.createdLinks ?? 1 }),
      delete: options.unassignError
        ? vi.fn().mockRejectedValue(options.unassignError)
        : vi.fn().mockResolvedValue({}),
    },
    department: {
      count: vi.fn().mockResolvedValue(counts.departments ?? 0),
      findMany: vi
        .fn()
        .mockResolvedValue((options.linkedDepartments ?? []).map((name) => ({ name }))),
    },
    $includingDeleted: () => includingDeleted,
  };
  const cache = { invalidate: vi.fn().mockResolvedValue(undefined) };
  const service = new FacultiesService(
    database as never,
    new AuditService({} as never),
    cache as never,
  );
  const afterCommit: Array<() => Promise<void>> = [];
  const changes: AuditChange[] = [];
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> =>
    auditScopeStorage.run({ tx: database as never, changes, afterCommit }, run);
  return { service, database, includingDeleted, changes, inAuditScope, cache, afterCommit };
};

const code = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiException ? error.code : "OTHER"),
  );

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.catch((error: unknown) => error);

describe("FacultiesService.list", () => {
  test("pages, sorts, searches and filters by university, listing each faculty's universities", async () => {
    const { service, database } = build({ counts: { students: 4, departments: 2 } });

    const result = await service.list({
      status: "all",
      page: 2,
      pageSize: 10,
      sort: "-name",
      q: "arts",
      universityId: dhaka,
    });

    const where = {
      name: { contains: "arts", mode: "insensitive" },
      universities: { some: { universityId: dhaka } },
    };
    expect(database.faculty.findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ name: "desc" }, { id: "asc" }],
      skip: 10,
      take: 10,
      include: {
        universities: {
          select: { university: { select: { id: true, name: true } } },
          orderBy: { university: { name: "asc" } },
        },
      },
    });
    expect(database.faculty.count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      items: [
        {
          id,
          name: "Faculty of Arts",
          archivedAt: null,
          createdAt: at.toISOString(),
          updatedAt: at.toISOString(),
          studentCount: 4,
          departmentCount: 2,
          universities: [{ id: dhaka, name: "University of Dhaka" }],
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  test("sorts by name ascending with no filter when none is given", async () => {
    const { service, database } = build();

    await service.list({ status: "all", page: 1, pageSize: 25 });

    expect(database.faculty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    );
  });

  test.each([
    ["createdAt", { createdAt: "asc" }],
    ["-createdAt", { createdAt: "desc" }],
  ] as const)("sorts by %s", async (sort, expected) => {
    const { service, database } = build();

    await service.list({ status: "all", page: 1, pageSize: 25, sort });

    expect(database.faculty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [expected, { id: "asc" }] }),
    );
  });

  test("reads the usage of the whole page with one query, soft-deleted profiles included", async () => {
    const { service, database, includingDeleted } = build({
      counts: { students: 1, departments: 1 },
    });

    await service.list({ status: "all", page: 1, pageSize: 25 });

    expect(includingDeleted.department.findMany).toHaveBeenCalledTimes(1);
    expect(includingDeleted.department.findMany).toHaveBeenCalledWith({
      where: { facultyId: { in: [id] } },
      select: { facultyId: true, _count: { select: { profiles: true } } },
    });
    expect(includingDeleted.studentProfile.count).not.toHaveBeenCalled();
    expect(database.department.count).not.toHaveBeenCalled();
  });

  test("an empty page makes no usage query", async () => {
    const { service, database, includingDeleted } = build();
    database.faculty.findMany.mockResolvedValue([]);

    const result = await service.list({ status: "all", page: 1, pageSize: 25 });

    expect(result.items).toEqual([]);
    expect(includingDeleted.department.findMany).not.toHaveBeenCalled();
  });
});

describe("FacultiesService.get", () => {
  test("returns the faculty with its usage and universities", async () => {
    const { service } = build({ counts: { students: 2, departments: 1 } });

    expect(await service.get(id)).toMatchObject({
      id,
      studentCount: 2,
      departmentCount: 1,
      universities: [{ id: dhaka, name: "University of Dhaka" }],
    });
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service } = build({ existing: null });

    expect(await code(service.get(id))).toBe("NOT_FOUND");
  });
});

describe("FacultiesService.create", () => {
  test("writes the faculty with no links and captures the new values", async () => {
    const { service, database, changes, inAuditScope } = build();

    const created = await inAuditScope(() => service.create({ name: "Faculty of Arts" }));

    expect(database.faculty.create).toHaveBeenCalledWith({
      data: { name: "Faculty of Arts" },
      include: expect.anything(),
    });
    expect(created).toMatchObject({ id, universities: [], studentCount: 0, departmentCount: 0 });
    expect(changes).toEqual([{ entityId: id, after: { name: "Faculty of Arts" } }]);
  });

  test("a name held by another faculty, compared without case, is DIRECTORY_NAME_TAKEN and nothing is written", async () => {
    const { service, database, changes, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.create({ name: "faculty of arts" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );

    expect(database.faculty.findFirst).toHaveBeenCalledWith({
      where: { name: { equals: "faculty of arts", mode: "insensitive" } },
      select: { id: true },
    });
    expect(database.faculty.create).not.toHaveBeenCalled();
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

describe("FacultiesService.update", () => {
  test("renames and captures the old and new name", async () => {
    const { service, database, changes, inAuditScope } = build();

    const updated = await inAuditScope(() => service.update(id, { name: "Faculty of Letters" }));

    expect(database.faculty.update).toHaveBeenCalledWith({
      where: { id },
      data: { name: "Faculty of Letters" },
      include: expect.anything(),
    });
    expect(updated.name).toBe("Faculty of Letters");
    expect(changes).toEqual([
      {
        entityId: id,
        before: { name: "Faculty of Arts" },
        after: { name: "Faculty of Letters" },
      },
    ]);
  });

  test("renaming to a name another faculty holds is DIRECTORY_NAME_TAKEN and the check excludes itself", async () => {
    const { service, database, inAuditScope } = build({ taken: { id: "other" } });

    expect(await code(inAuditScope(() => service.update(id, { name: "Science" })))).toBe(
      "DIRECTORY_NAME_TAKEN",
    );

    expect(database.faculty.findFirst).toHaveBeenCalledWith({
      where: { id: { not: id }, name: { equals: "Science", mode: "insensitive" } },
      select: { id: true },
    });
    expect(database.faculty.update).not.toHaveBeenCalled();
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

describe("FacultiesService.remove", () => {
  test("deletes an unreferenced faculty and captures the removed values", async () => {
    const { service, database, changes, inAuditScope } = build();

    await inAuditScope(() => service.remove(id));

    expect(database.faculty.delete).toHaveBeenCalledWith({ where: { id } });
    expect(changes).toEqual([{ entityId: id, before: { name: "Faculty of Arts" } }]);
  });

  test.each([
    ["student profiles", { students: 3 }, "3 students"],
    ["departments", { departments: 2 }, "2 departments"],
    ["university links", { universities: 1 }, "1 university link"],
  ] satisfies Array<[string, Counts, string]>)(
    "refuses with DIRECTORY_IN_USE while %s reference it",
    async (_name, counts, expected) => {
      const { service, database, inAuditScope } = build({ counts });

      const failure = await failureOf(inAuditScope(() => service.remove(id)));

      expect(failure).toBeInstanceOf(ApiException);
      expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
      expect((failure as ApiException).getStatus()).toBe(409);
      expect((failure as ApiException).detail).toContain(expected);
      expect(database.faculty.delete).not.toHaveBeenCalled();
    },
  );

  test("the message names every reference type and states the student count first", async () => {
    const { service, inAuditScope } = build({
      counts: { students: 1, departments: 2, universities: 3 },
    });

    const failure = await failureOf(inAuditScope(() => service.remove(id)));

    expect((failure as ApiException).detail).toBe(
      "This faculty is used by 1 student, 2 departments and 3 university links, so it cannot be deleted.",
    );
  });

  test("counts student profiles through the client that includes soft-deleted rows", async () => {
    const { service, includingDeleted, inAuditScope } = build({ counts: { students: 1 } });

    expect(await code(inAuditScope(() => service.remove(id)))).toBe("DIRECTORY_IN_USE");

    expect(includingDeleted.studentProfile.count).toHaveBeenCalledWith({
      where: { department: { facultyId: id } },
    });
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

describe("FacultiesService.assign", () => {
  test("creates the link and captures the university it was assigned to", async () => {
    const { service, database, changes, inAuditScope } = build({ linked: false });

    const result = await inAuditScope(() => service.assign(id, buet));

    expect(database.universityFaculty.createMany).toHaveBeenCalledWith({
      data: [{ universityId: buet, facultyId: id }],
      skipDuplicates: true,
    });
    expect(result.id).toBe(id);
    expect(changes).toEqual([
      { entityId: id, after: { universityId: buet, universityName: "BUET" } },
    ]);
  });

  test("assigning a pair that is already linked creates nothing and records an unchanged link", async () => {
    const { service, changes, inAuditScope } = build({ createdLinks: 0 });

    const result = await inAuditScope(() => service.assign(id, buet));

    expect(result.id).toBe(id);
    expect(changes).toEqual([
      {
        entityId: id,
        before: { universityId: buet, universityName: "BUET" },
        after: { universityId: buet, universityName: "BUET" },
      },
    ]);
  });

  test("an unknown faculty or university is NOT_FOUND and nothing is written", async () => {
    const missingFaculty = build({ existing: null });
    const missingUniversity = build({ university: null });

    expect(
      await code(missingFaculty.inAuditScope(() => missingFaculty.service.assign(id, buet))),
    ).toBe("NOT_FOUND");
    expect(
      await code(missingUniversity.inAuditScope(() => missingUniversity.service.assign(id, buet))),
    ).toBe("NOT_FOUND");
    expect(missingFaculty.database.universityFaculty.createMany).not.toHaveBeenCalled();
    expect(missingUniversity.database.universityFaculty.createMany).not.toHaveBeenCalled();
  });
});

describe("FacultiesService.assign races", () => {
  test("a foreign key violation because the faculty or university vanished is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ assignError: foreignKeyViolation });

    expect(await code(inAuditScope(() => service.assign(id, buet)))).toBe("NOT_FOUND");
  });

  test("any other error while linking is not hidden", async () => {
    const { service, inAuditScope } = build({ assignError: new Error("down") });

    expect(await code(inAuditScope(() => service.assign(id, buet)))).toBe("OTHER");
  });
});

describe("FacultiesService.unassign", () => {
  test("removes the link and captures the university it was removed from", async () => {
    const { service, database, changes, inAuditScope } = build();
    database.universityFaculty.findUnique.mockResolvedValue({
      universityId: dhaka,
      facultyId: id,
      university: { id: dhaka, name: "University of Dhaka" },
    });

    const result = await inAuditScope(() => service.unassign(id, dhaka));

    expect(database.universityFaculty.findUnique).toHaveBeenCalledWith({
      where: { universityId_facultyId: { universityId: dhaka, facultyId: id } },
      select: { university: { select: { id: true, name: true } } },
    });
    expect(database.universityFaculty.delete).toHaveBeenCalledWith({
      where: { universityId_facultyId: { universityId: dhaka, facultyId: id } },
    });
    expect(result.id).toBe(id);
    expect(changes).toEqual([
      { entityId: id, before: { universityId: dhaka, universityName: "University of Dhaka" } },
    ]);
  });

  test("is refused with DIRECTORY_IN_USE naming the departments while the pair has any", async () => {
    const { service, database, changes, inAuditScope } = build({
      linkedDepartments: ["Bengali", "History"],
    });
    database.universityFaculty.findUnique.mockResolvedValue({
      university: { id: dhaka, name: "University of Dhaka" },
    });

    const failure = await failureOf(inAuditScope(() => service.unassign(id, dhaka)));

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
    expect((failure as ApiException).getStatus()).toBe(409);
    expect((failure as ApiException).detail).toBe(
      "Faculty of Arts has 2 departments at University of Dhaka (Bengali, History), so it cannot be removed from that university.",
    );
    expect(database.department.findMany).toHaveBeenCalledWith({
      where: { universityId: dhaka, facultyId: id },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    expect(database.universityFaculty.delete).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("lists at most five department names and counts the rest", async () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    const { service, database, inAuditScope } = build({ linkedDepartments: names });
    database.universityFaculty.findUnique.mockResolvedValue({
      university: { id: dhaka, name: "University of Dhaka" },
    });

    const failure = await failureOf(inAuditScope(() => service.unassign(id, dhaka)));

    expect((failure as ApiException).detail).toContain("7 departments");
    expect((failure as ApiException).detail).toContain("(A, B, C, D, E and 2 more)");
  });

  test("a foreign key violation that slips past the check names the departments read outside the aborted transaction", async () => {
    const { service, database } = build({
      unassignError: foreignKeyViolation,
      linkedDepartments: ["Bengali"],
    });
    database.universityFaculty.findUnique.mockResolvedValue({
      university: { id: dhaka, name: "University of Dhaka" },
    });
    const transaction = {
      ...database,
      department: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockRejectedValue(new Error("25P02 transaction is aborted")),
      },
    };

    const failure = await failureOf(
      auditScopeStorage.run({ tx: transaction as never, changes: [] }, () =>
        service.unassign(id, dhaka),
      ),
    );

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("DIRECTORY_IN_USE");
    expect((failure as ApiException).detail).toContain("(Bengali)");
    expect(transaction.department.findMany).toHaveBeenCalledTimes(1);
    expect(database.department.findMany).toHaveBeenCalledTimes(1);
  });

  test("a faculty that is not linked to the university, or does not exist, is NOT_FOUND", async () => {
    const unlinked = build({ linked: false });
    const missing = build({ existing: null });

    expect(await code(unlinked.inAuditScope(() => unlinked.service.unassign(id, dhaka)))).toBe(
      "NOT_FOUND",
    );
    expect(await code(missing.inAuditScope(() => missing.service.unassign(id, dhaka)))).toBe(
      "NOT_FOUND",
    );
    expect(unlinked.database.universityFaculty.delete).not.toHaveBeenCalled();
  });
});

const settle = async (tasks: Array<() => Promise<void>>): Promise<void> => {
  await Promise.all(tasks.map((task) => task()));
};

describe("FacultiesService lookup cache invalidation", () => {
  test("create queues one invalidation that runs only after commit", async () => {
    const { cache, afterCommit, inAuditScope, service } = build();

    await inAuditScope(() => service.create({ name: "Faculty of Arts" }));

    expect(afterCommit).toHaveLength(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
    await settle(afterCommit);
    expect(cache.invalidate).toHaveBeenCalledOnce();
  });

  test("update queues one invalidation that runs only after commit", async () => {
    const { cache, afterCommit, inAuditScope, service } = build();

    await inAuditScope(() => service.update(id, { name: "Faculty of Letters" }));

    expect(afterCommit).toHaveLength(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
    await settle(afterCommit);
    expect(cache.invalidate).toHaveBeenCalledOnce();
  });

  test("remove queues one invalidation that runs only after commit", async () => {
    const { cache, afterCommit, inAuditScope, service } = build();

    await inAuditScope(() => service.remove(id));

    expect(afterCommit).toHaveLength(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
    await settle(afterCommit);
    expect(cache.invalidate).toHaveBeenCalledOnce();
  });

  test("assign queues one invalidation that runs only after commit", async () => {
    const { cache, afterCommit, inAuditScope, service } = build({ linked: false });

    await inAuditScope(() => service.assign(id, buet));

    expect(afterCommit).toHaveLength(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
    await settle(afterCommit);
    expect(cache.invalidate).toHaveBeenCalledOnce();
  });

  test("unassign queues one invalidation that runs only after commit", async () => {
    const { cache, afterCommit, inAuditScope, service, database } = build();
    database.universityFaculty.findUnique.mockResolvedValue({
      universityId: dhaka,
      facultyId: id,
      university: { id: dhaka, name: "University of Dhaka" },
    });

    await inAuditScope(() => service.unassign(id, dhaka));

    expect(afterCommit).toHaveLength(1);
    expect(cache.invalidate).not.toHaveBeenCalled();
    await settle(afterCommit);
    expect(cache.invalidate).toHaveBeenCalledOnce();
  });

  test("a refused write queues no invalidation", async () => {
    const { afterCommit, inAuditScope, service } = build({ linked: false });

    await inAuditScope(() => service.unassign(id, dhaka)).catch(() => undefined);

    expect(afterCommit).toHaveLength(0);
  });
});

describe("FacultiesService archive and restore", () => {
  test("archive is one guarded write, audited, and invalidates the cache after commit", async () => {
    const { service, database, changes, inAuditScope, cache, afterCommit } = build();
    database.faculty.findUnique.mockResolvedValue(row({ archivedAt: at }));

    const result = await inAuditScope(() => service.archive(id));

    expect(database.faculty.updateMany).toHaveBeenCalledWith({
      where: { id, archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    expect(result.archivedAt).toBe(at.toISOString());
    expect(changes).toEqual([
      {
        entityId: id,
        before: { name: "Faculty of Arts", archived: false },
        after: { name: "Faculty of Arts", archived: true },
      },
    ]);
    await Promise.all(afterCommit.map((task) => task()));
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  test("restore clears the flag on archived rows only", async () => {
    const { service, database, inAuditScope } = build();

    await inAuditScope(() => service.restore(id));

    expect(database.faculty.updateMany).toHaveBeenCalledWith({
      where: { id, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
  });

  test("repeating an archive changes nothing and records an unchanged state", async () => {
    const { service, database, changes, inAuditScope } = build({ archivedChanged: false });
    database.faculty.findUnique.mockResolvedValue(row({ archivedAt: at }));

    await inAuditScope(() => service.archive(id));

    expect(changes[0]).toMatchObject({ before: { archived: true }, after: { archived: true } });
  });

  test("an unknown id is NOT_FOUND", async () => {
    const { service, inAuditScope } = build({ existing: null, archivedChanged: false });

    expect(await code(inAuditScope(() => service.archive(id)))).toBe("NOT_FOUND");
  });
});

describe("FacultiesService assign to or from archived records", () => {
  test("an archived faculty cannot be assigned to a university", async () => {
    const { service, database, changes, inAuditScope } = build({
      existing: row({ archivedAt: at }),
    });

    expect(await code(inAuditScope(() => service.assign(id, buet)))).toBe("DIRECTORY_ARCHIVED");
    expect(database.universityFaculty.createMany).not.toHaveBeenCalled();
    expect(changes).toEqual([]);
  });

  test("a faculty cannot be assigned to an archived university", async () => {
    const { service, database, inAuditScope } = build({
      university: { id: buet, name: "BUET", archivedAt: at },
    });

    expect(await code(inAuditScope(() => service.assign(id, buet)))).toBe("DIRECTORY_ARCHIVED");
    expect(database.universityFaculty.createMany).not.toHaveBeenCalled();
  });

  test("an archive that lands between the check and the write is refused and rolls back", async () => {
    const { service, database, inAuditScope } = build();
    database.faculty.findUnique
      .mockResolvedValueOnce(row())
      .mockResolvedValue(row({ archivedAt: at }));

    expect(await code(inAuditScope(() => service.assign(id, buet)))).toBe("DIRECTORY_ARCHIVED");
  });
});

describe("FacultiesService status filter", () => {
  test.each([
    ["active", { archivedAt: null }],
    ["archived", { archivedAt: { not: null } }],
    ["all", {}],
  ] as const)("status %s", async (status, expected) => {
    const { service, database } = build();

    await service.list({ status, page: 1, pageSize: 25 });

    expect(database.faculty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expected }),
    );
  });
});
