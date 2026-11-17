import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY } from "../../src/access/access.decorators";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";
import { SignedInEnrollmentController } from "../../src/enrollment/signed-in-enrollment.controller";

describe("SignedInEnrollmentController.request", () => {
  test("hands the session user and body to the service", async () => {
    const request = vi.fn().mockResolvedValue({ status: "PENDING_APPROVAL" });
    const controller = new SignedInEnrollmentController({ request } as never);
    const body = { courseSlug: "gender-safety" };

    const result = await controller.request(body as never, { userId: "user-id" } as never);

    expect(result).toEqual({ status: "PENDING_APPROVAL" });
    expect(request).toHaveBeenCalledWith("user-id", body);
  });

  test("is student only and limited by the enrollment profile", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, SignedInEnrollmentController)).toBe("student");
    expect(
      Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, SignedInEnrollmentController.prototype.request),
    ).toBe("enrollment");
  });
});
