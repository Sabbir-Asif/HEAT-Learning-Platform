import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { EnrollmentApprovalController } from "../../src/enrollment/enrollment-approval.controller";

const session = { userId: "admin-id" };
const request = { ip: "203.0.113.4", headers: { "x-request-id": "req-1" } };
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };

describe("EnrollmentApprovalController", () => {
  test("is limited to the admin audience and admin roles", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, EnrollmentApprovalController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, EnrollmentApprovalController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("lists the queue through the queue service", async () => {
    const list = vi.fn().mockResolvedValue({ items: [] });
    const controller = new EnrollmentApprovalController({ list } as never, {} as never);

    await controller.listPending({ page: 1 } as never);

    expect(list).toHaveBeenCalledWith({ page: 1 });
  });

  test("approves one request as the signed-in admin", async () => {
    const approve = vi.fn().mockResolvedValue({ id: "e" });
    const controller = new EnrollmentApprovalController({} as never, { approve } as never);

    await controller.approve(
      { id: "e" } as never,
      { reason: "ok" } as never,
      session as never,
      request as never,
    );

    expect(approve).toHaveBeenCalledWith("e", actor, "ok");
  });

  test("approves many requests as the signed-in admin", async () => {
    const approveMany = vi.fn().mockResolvedValue({ succeeded: [], failed: [] });
    const controller = new EnrollmentApprovalController({} as never, { approveMany } as never);

    await controller.approveMany(
      { ids: ["a", "b"], reason: "ok" } as never,
      session as never,
      request as never,
    );

    expect(approveMany).toHaveBeenCalledWith(["a", "b"], actor, "ok");
  });
});
