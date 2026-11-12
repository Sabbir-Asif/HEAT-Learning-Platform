import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { StudentDetailController } from "../../src/enrollment/student-detail.controller";

describe("StudentDetailController", () => {
  test("is limited to the admin audience and admin roles", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, StudentDetailController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, StudentDetailController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("reads the student through the service", async () => {
    const get = vi.fn().mockResolvedValue({ userId: "u" });

    await new StudentDetailController({ get } as never).get({ id: "u" });

    expect(get).toHaveBeenCalledWith("u");
  });

  test("never lets shared caches keep the response", () => {
    expect(
      Reflect.getMetadata("__headers__", StudentDetailController.prototype.get),
    ).toContainEqual({ name: "Cache-Control", value: "no-store" });
  });
});
