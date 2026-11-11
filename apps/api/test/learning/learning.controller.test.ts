import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, COURSE_ACCESS_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { LearningController } from "../../src/learning/learning.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("LearningController", () => {
  test("is student only with the course access check and the learningRead rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, LearningController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, LearningController)).toBeUndefined();
    expect(Reflect.getMetadata(COURSE_ACCESS_KEY, LearningController.prototype.structure)).toBe(
      "courseId",
    );
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, LearningController.prototype.structure),
    ).toBe("learningRead");
  });

  test("passes the session user and the course id to the service", async () => {
    const describe = vi.fn().mockResolvedValue({ modules: [] });
    const controller = new LearningController({ describe } as never);

    await controller.structure({ courseId: "c1" }, { userId: "u1" } as never);

    expect(describe).toHaveBeenCalledWith("u1", "c1");
  });
});
