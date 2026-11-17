import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { ProfileChangeAdminService } from "../../src/profile-changes/profile-change-admin.service";

const now = new Date("2026-11-17T05:00:00.000Z");

const pendingRow = {
  status: "PENDING",
  requestedName: "Anne Jones",
  requestedDepartmentId: "new-department-id",
  requestedSession: "2021-22",
  requestedDepartment: { id: "new-department-id", name: "Chemistry" },
  user: {
    id: "user-id",
    deletedAt: null,
    profile: {
      id: "profile-id",
      name: "Anne Smith",
      session: "2020-21",
      department: { id: "department-id", name: "Physics" },
    },
  },
};

const build = (options: { row?: unknown; claimed?: number; offerError?: Error } = {}) => {
  const order: string[] = [];
  const db = {
    profileChangeRequest: {
      findFirst: vi.fn().mockResolvedValue("row" in options ? options.row : pendingRow),
      updateMany: vi.fn().mockImplementation(async () => {
        order.push("claim");
        return { count: options.claimed ?? 1 };
      }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    studentProfile: {
      update: vi.fn().mockImplementation(async () => {
        order.push("profile");
        return {};
      }),
    },
    notification: {
      create: vi.fn().mockImplementation(async () => {
        order.push("notification");
        return {};
      }),
    },
  };
  const audit = { client: vi.fn().mockReturnValue(db), capture: vi.fn() };
  const departments = {
    assertDepartmentOfferable: vi.fn().mockImplementation(async () => {
      order.push("directory");
      if (options.offerError !== undefined) throw options.offerError;
    }),
  };
  const service = new ProfileChangeAdminService(
    db as never,
    { now: () => now } as never,
    departments as never,
    audit as never,
  );
  return { service, db, audit, departments, order };
};

describe("ProfileChangeAdminService.approve", () => {
  test("applies the change, notifies the student and records before and after together", async () => {
    const { service, db, audit, order } = build();

    const result = await service.approve("request-id", "admin-id");

    expect(order).toEqual(["directory", "claim", "profile", "notification"]);
    expect(db.profileChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-id", status: "PENDING" },
      data: { status: "APPROVED", decidedById: "admin-id", decidedAt: now },
    });
    expect(db.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: { name: "Anne Jones", departmentId: "new-department-id", session: "2021-22" },
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-id",
        type: "PROFILE_CHANGE_APPROVED",
        data: { requestId: "request-id" },
      },
    });
    expect(audit.capture).toHaveBeenCalledWith({
      entityId: "request-id",
      before: {
        userId: "user-id",
        name: "Anne Smith",
        departmentId: "department-id",
        departmentName: "Physics",
        cohort: "2020-21",
      },
      after: {
        userId: "user-id",
        name: "Anne Jones",
        departmentId: "new-department-id",
        departmentName: "Chemistry",
        cohort: "2021-22",
      },
    });
    expect(result).toEqual({ id: "request-id", status: "APPROVED", decidedAt: now.toISOString() });
  });

  test("changes only the requested fields", async () => {
    const { service, db } = build({
      row: {
        ...pendingRow,
        requestedName: "Anne Jones",
        requestedDepartmentId: null,
        requestedDepartment: null,
        requestedSession: null,
      },
    });

    await service.approve("request-id", "admin-id");

    expect(db.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: { name: "Anne Jones" },
    });
  });

  test("refuses an archived or mismatched department with a field error and writes nothing", async () => {
    const offerError = new ApiException(400, "VALIDATION_FAILED", undefined, undefined, [
      { path: "departmentId", code: "invalid_value" },
    ]);
    const { service, db, audit } = build({ offerError });

    await expect(service.approve("request-id", "admin-id")).rejects.toBe(offerError);
    expect(db.profileChangeRequest.updateMany).not.toHaveBeenCalled();
    expect(db.studentProfile.update).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
    expect(audit.capture).not.toHaveBeenCalled();
  });

  test("refuses a stored non-Latin name", async () => {
    const { service, db } = build({ row: { ...pendingRow, requestedName: "আমিনা" } });

    await expect(service.approve("request-id", "admin-id")).rejects.toMatchObject({
      fields: [{ path: "name", code: "invalid_format" }],
    });
    expect(db.studentProfile.update).not.toHaveBeenCalled();
  });

  test("refuses a request that was already decided", async () => {
    const { service, db } = build({ row: { ...pendingRow, status: "APPROVED" } });

    await expect(service.approve("request-id", "admin-id")).rejects.toMatchObject({
      code: "PROFILE_CHANGE_NOT_PENDING",
    });
    expect(db.studentProfile.update).not.toHaveBeenCalled();
  });

  test("refuses when another admin decided it first", async () => {
    const { service, db } = build({ claimed: 0 });

    await expect(service.approve("request-id", "admin-id")).rejects.toMatchObject({
      code: "PROFILE_CHANGE_NOT_PENDING",
    });
    expect(db.studentProfile.update).not.toHaveBeenCalled();
    expect(db.notification.create).not.toHaveBeenCalled();
  });

  test("answers not found for a missing request", async () => {
    const { service } = build({ row: null });

    await expect(service.approve("request-id", "admin-id")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("ProfileChangeAdminService.reject", () => {
  test("stores the reason, notifies the student and leaves the profile alone", async () => {
    const { service, db, audit } = build();

    const result = await service.reject("request-id", "admin-id", "Name does not match records");

    expect(db.profileChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-id", status: "PENDING" },
      data: {
        status: "REJECTED",
        decidedById: "admin-id",
        decidedAt: now,
        reason: "Name does not match records",
      },
    });
    expect(db.studentProfile.update).not.toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-id",
        type: "PROFILE_CHANGE_REJECTED",
        data: { requestId: "request-id", reason: "Name does not match records" },
      },
    });
    expect(audit.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "request-id",
        after: { userId: "user-id", status: "REJECTED", reason: "Name does not match records" },
      }),
    );
    expect(result.status).toBe("REJECTED");
  });

  test("refuses a request that was already decided", async () => {
    const { service } = build({ row: { ...pendingRow, status: "REJECTED" } });

    await expect(service.reject("request-id", "admin-id", "No")).rejects.toMatchObject({
      code: "PROFILE_CHANGE_NOT_PENDING",
    });
  });
});

describe("ProfileChangeAdminService.list", () => {
  test("lists pending requests oldest first with paging", async () => {
    const { service, db } = build();

    const result = await service.list({ status: "PENDING", page: 2, pageSize: 10 });

    expect(db.profileChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PENDING", user: { deletedAt: null } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
  });

  test("lists decided requests newest first", async () => {
    const { service, db } = build();

    await service.list({ status: "REJECTED", page: 1, pageSize: 25 });

    expect(db.profileChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    );
  });
});
