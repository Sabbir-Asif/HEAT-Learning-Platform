import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, COURSE_ACCESS_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { QuizAccessController } from "../../src/learning/quiz-access.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("QuizAccessController", () => {
  test("is student only with the learningRead rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, QuizAccessController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, QuizAccessController)).toBeUndefined();
    expect(
      Reflect.getMetadata(COURSE_ACCESS_KEY, QuizAccessController.prototype.check),
    ).toBeUndefined();
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, QuizAccessController.prototype.check)).toBe(
      "learningRead",
    );
  });

  test("returns the module state the gate reports", async () => {
    const requireUnlocked = vi.fn().mockResolvedValue("QUIZ_READY");
    const controller = new QuizAccessController({ requireUnlocked } as never);
    const result = await controller.check({ courseId: "c1", moduleId: "m1" }, {
      userId: "u1",
    } as never);
    expect(requireUnlocked).toHaveBeenCalledWith("u1", "c1", "m1");
    expect(result).toEqual({ moduleState: "QUIZ_READY" });
  });
});
