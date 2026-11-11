import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";
import { IS_PUBLIC } from "../../src/auth";
import { describe, expect, test, vi } from "vitest";
import { EnrollmentController } from "../../src/enrollment/enrollment.controller";

describe("EnrollmentController.submit", () => {
  test("hands the body to the service", async () => {
    const submit = vi.fn().mockResolvedValue({ accepted: true });
    const controller = new EnrollmentController({ submit } as never);
    const body = { email: "anne@example.com" };

    expect(await controller.submit(body as never)).toEqual({ accepted: true });
    expect(submit).toHaveBeenCalledWith(body);
  });

  test("is public and limited by the enrollment profile", () => {
    const handler = EnrollmentController.prototype.submit;
    expect(Reflect.getMetadata(IS_PUBLIC, handler)).toBe(true);
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, handler)).toBe("enrollment");
  });
});
