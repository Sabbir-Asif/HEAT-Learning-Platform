import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";
import { IS_PUBLIC } from "../../src/auth";
import { describe, expect, test, vi } from "vitest";
import { EnrollmentController } from "../../src/enrollment/enrollment.controller";

describe("EnrollmentController.submit", () => {
  test("hands the body and the request actor to the service", async () => {
    const submit = vi.fn().mockResolvedValue({ accepted: true });
    const controller = new EnrollmentController({ submit } as never);
    const body = { email: "anne@example.com" };

    const request = { ip: "203.0.113.4", headers: { "x-request-id": "req-1" } };

    expect(await controller.submit(body as never, request as never)).toEqual({ accepted: true });
    expect(submit).toHaveBeenCalledWith(body, {
      actorId: null,
      ipAddress: "203.0.113.4",
      requestId: "req-1",
    });
  });

  test("is public and limited by the enrollment profile", () => {
    const handler = EnrollmentController.prototype.submit;
    expect(Reflect.getMetadata(IS_PUBLIC, handler)).toBe(true);
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, handler)).toBe("enrollment");
  });
});
