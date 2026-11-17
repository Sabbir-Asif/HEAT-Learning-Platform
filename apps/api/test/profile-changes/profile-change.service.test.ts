import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { ProfileChangeService } from "../../src/profile-changes/profile-change.service";

const profile = {
  name: "Anne Smith",
  session: "2020-21",
  department: {
    id: "department-id",
    universityFaculty: { universityId: "university-id", facultyId: "faculty-id" },
  },
};

const created = {
  id: "request-id",
  status: "PENDING",
  requestedName: "Anne Jones",
  requestedSession: null,
  note: "Married name",
  reason: null,
  createdAt: new Date("2026-11-17T04:00:00.000Z"),
  decidedAt: null,
  requestedDepartment: null,
};

const request = {
  name: "Anne Jones",
  universityId: "university-id",
  facultyId: "faculty-id",
  departmentId: "department-id",
  session: "2020-21",
  note: "Married name",
};

const build = (options: { open?: number; profile?: unknown; createError?: unknown } = {}) => {
  const database = {
    studentProfile: {
      findFirst: vi.fn().mockResolvedValue("profile" in options ? options.profile : profile),
    },
    profileChangeRequest: {
      count: vi.fn().mockResolvedValue(options.open ?? 0),
      create:
        options.createError === undefined
          ? vi.fn().mockResolvedValue(created)
          : vi.fn().mockRejectedValue(options.createError),
      findFirst: vi.fn().mockResolvedValue(created),
    },
  };
  const departments = { assertDepartmentOfferable: vi.fn().mockResolvedValue(undefined) };
  const service = new ProfileChangeService(database as never, departments as never);
  return { service, database, departments };
};

describe("ProfileChangeService.submit", () => {
  test("stores only the changed fields and the note", async () => {
    const { service, database } = build();

    const result = await service.submit("user-id", request);

    expect(database.profileChangeRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: "user-id", requestedName: "Anne Jones", note: "Married name" },
      }),
    );
    expect(result.status).toBe("PENDING");
    expect(result.requested.name).toBe("Anne Jones");
  });

  test("refuses a second request while one is open", async () => {
    const { service, database } = build({ open: 1 });

    await expect(service.submit("user-id", request)).rejects.toMatchObject({
      code: "PROFILE_CHANGE_PENDING",
    });
    expect(database.profileChangeRequest.create).not.toHaveBeenCalled();
  });

  test("maps a lost race on the one-open-request index to the pending code", async () => {
    const { service } = build({ createError: { code: "P2002" } });

    await expect(service.submit("user-id", request)).rejects.toMatchObject({
      code: "PROFILE_CHANGE_PENDING",
    });
  });

  test("rethrows other storage errors", async () => {
    const failure = new Error("down");
    const { service } = build({ createError: failure });

    await expect(service.submit("user-id", request)).rejects.toBe(failure);
  });

  test("refuses a request that changes nothing", async () => {
    const { service, database } = build();

    await expect(
      service.submit("user-id", { ...request, name: "Anne Smith" }),
    ).rejects.toMatchObject({ code: "PROFILE_CHANGE_UNCHANGED" });
    expect(database.profileChangeRequest.create).not.toHaveBeenCalled();
  });

  test("checks a new department against the chosen university and faculty", async () => {
    const { service, departments } = build();

    await service.submit("user-id", { ...request, departmentId: "other-department" });

    expect(departments.assertDepartmentOfferable).toHaveBeenCalledWith(
      "other-department",
      expect.anything(),
      { universityId: "university-id", facultyId: "faculty-id" },
    );
  });

  test("passes on the field error for an archived or mismatched department and saves nothing", async () => {
    const { service, database, departments } = build();
    departments.assertDepartmentOfferable.mockRejectedValue(
      new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
        { path: "departmentId", code: "invalid_value" },
      ]),
    );

    await expect(
      service.submit("user-id", { ...request, departmentId: "archived-department" }),
    ).rejects.toMatchObject({ fields: [{ path: "departmentId", code: "invalid_value" }] });
    expect(database.profileChangeRequest.create).not.toHaveBeenCalled();
  });

  test("checks the pair when only the university changes", async () => {
    const { service, departments } = build();

    await service.submit("user-id", { ...request, universityId: "other-university" });

    expect(departments.assertDepartmentOfferable).toHaveBeenCalledOnce();
  });

  test("does not recheck an unchanged department", async () => {
    const { service, departments } = build();

    await service.submit("user-id", request);

    expect(departments.assertDepartmentOfferable).not.toHaveBeenCalled();
  });

  test("answers not found when the student has no profile", async () => {
    const { service } = build({ profile: null });

    await expect(service.submit("user-id", request)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("ProfileChangeService.latest", () => {
  test("returns the newest request of the student", async () => {
    const { service, database } = build();

    const result = await service.latest("user-id");

    expect(database.profileChangeRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-id" } }),
    );
    expect(result.request?.id).toBe("request-id");
  });

  test("returns null when the student never asked", async () => {
    const { service, database } = build();
    database.profileChangeRequest.findFirst.mockResolvedValue(null);

    expect(await service.latest("user-id")).toEqual({ request: null });
  });
});
