import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, COURSE_ACCESS_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { QuizSubmissionController } from "../../src/learning/quiz-submission.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("QuizSubmissionController", () => {
  test("is student only with the quizSubmit rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, QuizSubmissionController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, QuizSubmissionController)).toBeUndefined();
    expect(
      Reflect.getMetadata(COURSE_ACCESS_KEY, QuizSubmissionController.prototype.submit),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, QuizSubmissionController.prototype.submit),
    ).toBe("quizSubmit");
  });

  test("delegates with the session user, the route ids and the body", async () => {
    const submit = vi.fn().mockResolvedValue({ passed: true });
    const controller = new QuizSubmissionController({ submit } as never);
    const body = { attemptId: "a1", idempotencyKey: "k1", answers: {} };
    const result = await controller.submit({ courseId: "c1", moduleId: "m1" }, body, {
      userId: "u1",
    } as never);
    expect(submit).toHaveBeenCalledWith("u1", "c1", "m1", body);
    expect(result).toEqual({ passed: true });
  });
});
