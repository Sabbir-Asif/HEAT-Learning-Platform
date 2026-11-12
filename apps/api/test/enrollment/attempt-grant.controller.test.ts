import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AttemptGrantController } from "../../src/enrollment/attempt-grant.controller";

const session = { userId: "admin-id" };
const request = { ip: "203.0.113.4", headers: { "x-request-id": "req-1" } };
const actor = { actorId: "admin-id", ipAddress: "203.0.113.4", requestId: "req-1" };

describe("AttemptGrantController", () => {
  test("is limited to the admin audience and admin roles", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, AttemptGrantController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, AttemptGrantController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("grants as the signed-in admin", async () => {
    const grant = vi.fn().mockResolvedValue({ id: "g" });
    const controller = new AttemptGrantController({ grant } as never);

    await controller.grant(
      { id: "e", quizId: "q" } as never,
      { reason: "Power cut" } as never,
      session as never,
      request as never,
    );

    expect(grant).toHaveBeenCalledWith("e", "q", actor, "Power cut");
  });
});
