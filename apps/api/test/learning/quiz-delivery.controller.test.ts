import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, COURSE_ACCESS_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { QuizDeliveryController } from "../../src/learning/quiz-delivery.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("QuizDeliveryController", () => {
  test("is student only with the learningRead rate limit", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, QuizDeliveryController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, QuizDeliveryController)).toBeUndefined();
    expect(
      Reflect.getMetadata(COURSE_ACCESS_KEY, QuizDeliveryController.prototype.get),
    ).toBeUndefined();
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, QuizDeliveryController.prototype.get)).toBe(
      "learningRead",
    );
  });

  test("delegates with the session user and the route ids", async () => {
    const get = vi.fn().mockResolvedValue({ status: "EXHAUSTED" });
    const controller = new QuizDeliveryController({ get } as never);
    const result = await controller.get({ courseId: "c1", moduleId: "m1" }, {
      userId: "u1",
    } as never);
    expect(get).toHaveBeenCalledWith("u1", "c1", "m1");
    expect(result).toEqual({ status: "EXHAUSTED" });
  });
});
