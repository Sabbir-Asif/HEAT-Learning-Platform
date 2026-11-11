import { describe, expect, test, vi } from "vitest";
import { DepartmentOfferingService } from "../../src/directory/department-offering.service";
import { ApiException } from "../../src/http/api-exception";

const id = "0198f1a0-0000-7000-8000-0000000000d1";

const build = (found: { id: string } | null) => {
  const database = { department: { findFirst: vi.fn().mockResolvedValue(found) } };
  return { database, service: new DepartmentOfferingService(database as never) };
};

describe("DepartmentOfferingService.assertDepartmentOfferable", () => {
  test("accepts a department whose own flag and parents are all active", async () => {
    const { service, database } = build({ id });

    await expect(service.assertDepartmentOfferable(id)).resolves.toBeUndefined();
    expect(database.department.findFirst).toHaveBeenCalledWith({
      where: {
        id,
        archivedAt: null,
        universityFaculty: { university: { archivedAt: null }, faculty: { archivedAt: null } },
      },
      select: { id: true },
    });
  });

  test("also matches the university and faculty the department sits under", async () => {
    const { service, database } = build({ id });
    const parents = { universityId: "u-1", facultyId: "f-1" };

    await service.assertDepartmentOfferable(id, database as never, parents);

    expect(database.department.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id, ...parents }) }),
    );
  });

  test("refuses an archived, hidden or unknown department with a field error on departmentId", async () => {
    const { service } = build(null);

    const failure = await service.assertDepartmentOfferable(id).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect(failure).toMatchObject({
      code: "VALIDATION_FAILED",
      fields: [{ path: "departmentId", code: "invalid_value" }],
    });
    expect((failure as ApiException).getStatus()).toBe(400);
  });
});
