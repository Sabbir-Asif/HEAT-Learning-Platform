import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, COURSE_ACCESS_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { LessonContentController } from "../../src/learning/lesson-content.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("LessonContentController", () => {
  test("is student only, checks enrollment in the service and has the learningRead rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, LessonContentController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, LessonContentController)).toBeUndefined();
    expect(
      Reflect.getMetadata(COURSE_ACCESS_KEY, LessonContentController.prototype.read),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, LessonContentController.prototype.read),
    ).toBe("learningRead");
  });

  test("passes the session user, course id and module id to the service", async () => {
    const read = vi.fn().mockResolvedValue({ sections: [] });
    const controller = new LessonContentController({ read } as never);

    await controller.read({ courseId: "c1", moduleId: "m1" }, { userId: "u1" } as never);

    expect(read).toHaveBeenCalledWith("u1", "c1", "m1");
  });
});
