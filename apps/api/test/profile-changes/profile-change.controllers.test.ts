import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { ProfileChangeAdminController } from "../../src/profile-changes/profile-change-admin.controller";
import { ProfileChangeController } from "../../src/profile-changes/profile-change.controller";

const session = { userId: "user-id" };

describe("ProfileChangeController", () => {
  test("is limited to the student audience", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, ProfileChangeController)).toBe("student");
  });

  test("reads and submits for the signed-in student only", async () => {
    const latest = vi.fn().mockResolvedValue({ request: null });
    const submit = vi.fn().mockResolvedValue({ id: "r" });
    const controller = new ProfileChangeController({ latest, submit } as never);

    await controller.latest(session as never);
    await controller.submit({ name: "Anne" } as never, session as never);

    expect(latest).toHaveBeenCalledWith("user-id");
    expect(submit).toHaveBeenCalledWith("user-id", { name: "Anne" });
  });
});

describe("ProfileChangeAdminController", () => {
  test("is limited to the admin audience and admin roles", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, ProfileChangeAdminController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, ProfileChangeAdminController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("audits both decisions", () => {
    const prototype = ProfileChangeAdminController.prototype;
    expect(Reflect.getMetadata(AUDITED_KEY, prototype.approve)).toEqual({
      action: "profile-change.approve",
      entity: "ProfileChangeRequest",
    });
    expect(Reflect.getMetadata(AUDITED_KEY, prototype.reject)).toEqual({
      action: "profile-change.reject",
      entity: "ProfileChangeRequest",
    });
  });

  test("decides as the signed-in admin", async () => {
    const approve = vi.fn().mockResolvedValue({});
    const reject = vi.fn().mockResolvedValue({});
    const controller = new ProfileChangeAdminController({ approve, reject } as never);

    await controller.approve({ id: "r" } as never, { userId: "admin-id" } as never);
    await controller.reject(
      { id: "r" } as never,
      { reason: "No" } as never,
      {
        userId: "admin-id",
      } as never,
    );

    expect(approve).toHaveBeenCalledWith("r", "admin-id");
    expect(reject).toHaveBeenCalledWith("r", "admin-id", "No");
  });
});
