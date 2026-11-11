import { describe, expect, test, vi } from "vitest";
import {
  AUDIENCE_KEY,
  COURSE_ACCESS_KEY,
  CSRF_BODY_TOKEN_KEY,
  ROLES_KEY,
} from "../../src/access/access.decorators";
import { ProgressController } from "../../src/playback/progress.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("ProgressController", () => {
  test("is student only, rate limited per account and accepts a body csrf token", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, ProgressController)).toBe("student");
    expect(Reflect.getMetadata(ROLES_KEY, ProgressController)).toBeUndefined();
    expect(
      Reflect.getMetadata(COURSE_ACCESS_KEY, ProgressController.prototype.record),
    ).toBeUndefined();
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, ProgressController.prototype.record)).toBe(
      "playbackProgress",
    );
    expect(Reflect.getMetadata(CSRF_BODY_TOKEN_KEY, ProgressController.prototype.record)).toBe(
      true,
    );
  });

  test("passes the session user, video and batch to the service", async () => {
    const record = vi.fn().mockResolvedValue({
      coveragePercent: 1,
      resumePositionSeconds: 2,
      completed: false,
    });
    const controller = new ProgressController({ record } as never);
    const batch = { sessionId: "s", sequence: 1, positionSeconds: 2, intervals: [] };
    await controller.record({ id: "v1" }, batch, { userId: "u1" } as never);
    expect(record).toHaveBeenCalledWith("u1", "v1", batch);
  });
});
