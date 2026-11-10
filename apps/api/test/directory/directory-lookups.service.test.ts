import { describe, expect, test, vi } from "vitest";
import { DirectoryLookupsService } from "../../src/directory/directory-lookups.service";

const university = "0198F1A0-0000-7000-8000-000000000001";
const faculty = "0198f1a0-0000-7000-8000-000000000002";

const build = () => {
  const database = {
    university: { findMany: vi.fn().mockResolvedValue([{ id: "u", name: "Dhaka" }]) },
    faculty: { findMany: vi.fn().mockResolvedValue([]) },
    department: { findMany: vi.fn().mockResolvedValue([{ id: "d", name: "CSE" }]) },
  };
  const cache = {
    remember: vi.fn(
      async (...args: [string, () => Promise<unknown>, ((value: never) => boolean)?]) => args[1](),
    ),
  };
  return {
    database,
    cache,
    service: new DirectoryLookupsService(database as never, cache as never),
  };
};

describe("DirectoryLookupsService", () => {
  test("universities selects only id and name of active rows ordered by name", async () => {
    const { service, database, cache } = build();

    const result = await service.universities();

    expect(result).toEqual({ items: [{ id: "u", name: "Dhaka" }] });
    expect(cache.remember).toHaveBeenCalledWith(
      "universities",
      expect.any(Function),
      expect.any(Function),
    );
    expect(database.university.findMany).toHaveBeenCalledWith({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  test("faculties requires an active faculty linked to an active university", async () => {
    const { service, database, cache } = build();

    const result = await service.faculties(university);

    expect(result).toEqual({ items: [] });
    expect(cache.remember.mock.calls[0]?.[0]).toBe(`faculties:${university.toLowerCase()}`);
    expect(database.faculty.findMany).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        universities: { some: { universityId: university, university: { archivedAt: null } } },
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  test("departments requires the pair and both parents to be active", async () => {
    const { service, database, cache } = build();

    const result = await service.departments(university, faculty);

    expect(result).toEqual({ items: [{ id: "d", name: "CSE" }] });
    expect(cache.remember.mock.calls[0]?.[0]).toBe(
      `departments:${university.toLowerCase()}:${faculty}`,
    );
    expect(database.department.findMany).toHaveBeenCalledWith({
      where: {
        universityId: university,
        facultyId: faculty,
        archivedAt: null,
        universityFaculty: { university: { archivedAt: null }, faculty: { archivedAt: null } },
      },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  test("empty answers are not stored in the cache", async () => {
    const { service, cache } = build();

    await service.faculties(university);

    const shouldStore = cache.remember.mock.calls[0]?.[2] as (value: {
      items: unknown[];
    }) => boolean;
    expect(shouldStore({ items: [] })).toBe(false);
    expect(shouldStore({ items: [{}] })).toBe(true);
  });
});
