import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY } from "../../src/access/access.decorators";
import { QuizResultController } from "../../src/learning/quiz-result.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("QuizResultController", () => {
  test("is student only with the learningRead rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, QuizResultController)).toBe("student");
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, QuizResultController.prototype.get)).toBe(
      "learningRead",
    );
  });

  test("delegates with the session user and the route ids", async () => {
    const get = vi.fn().mockResolvedValue({ attemptId: "a1" });
    const controller = new QuizResultController({ get } as never);
    const result = await controller.get({ courseId: "c1", moduleId: "m1", attemptId: "a1" }, {
      userId: "u1",
    } as never);
    expect(get).toHaveBeenCalledWith("u1", "c1", "m1", "a1");
    expect(result).toEqual({ attemptId: "a1" });
  });
});
