import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { EnrollmentRemovalController } from "../../src/enrollment/enrollment-removal.controller";

const session = { userId: "admin-id" };
const request = { ip: "203.0.113.4", headers: { "x-request-id": "req-1" } };
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };

describe("EnrollmentRemovalController", () => {
  test("is limited to the admin audience and admin roles", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, EnrollmentRemovalController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, EnrollmentRemovalController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("removes as the signed-in admin", async () => {
    const remove = vi.fn().mockResolvedValue({ id: "e" });
    const controller = new EnrollmentRemovalController({ remove } as never);

    await controller.remove(
      { id: "e" } as never,
      { reason: "Left" } as never,
      session as never,
      request as never,
    );

    expect(remove).toHaveBeenCalledWith("e", actor, "Left");
  });

  test("reinstates as the signed-in admin", async () => {
    const reinstate = vi.fn().mockResolvedValue({ id: "e" });
    const controller = new EnrollmentRemovalController({ reinstate } as never);

    await controller.reinstate(
      { id: "e" } as never,
      {} as never,
      session as never,
      request as never,
    );

    expect(reinstate).toHaveBeenCalledWith("e", actor, undefined);
  });
});
