import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, COURSE_ACCESS_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { DashboardController } from "../../src/learning/dashboard.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("DashboardController", () => {
  test("is student only, owner scoped in the service and has the learningRead rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, DashboardController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, DashboardController)).toBeUndefined();
    expect(
      Reflect.getMetadata(COURSE_ACCESS_KEY, DashboardController.prototype.describe),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, DashboardController.prototype.describe),
    ).toBe("learningRead");
  });

  test("passes only the session user to the service", async () => {
    const describe = vi.fn().mockResolvedValue({ courses: [] });
    const controller = new DashboardController({ describe } as never);

    await controller.describe({ userId: "u1" } as never);

    expect(describe).toHaveBeenCalledWith("u1");
  });
});
