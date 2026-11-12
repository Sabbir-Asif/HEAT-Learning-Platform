import { describe, expect, test } from "vitest";
import { reinstatementTarget, removalRefusal } from "../../src/enrollment/removal-rules";

describe("removalRefusal", () => {
  test.each(["APPROVED", "COMPLETED"] as const)("allows removing from %s", (status) => {
    expect(removalRefusal(status)).toBeNull();
  });

  test.each([
    "PENDING_VERIFICATION",
    "PENDING_APPROVAL",
    "REJECTED",
    "EXPIRED",
    "REMOVED",
  ] as const)("refuses removing from %s with a conflict", (status) => {
    const refusal = removalRefusal(status);
    expect(refusal).toMatchObject({ code: "ENROLLMENT_NOT_REMOVABLE" });
    expect(refusal?.getStatus()).toBe(409);
  });
});

describe("reinstatementTarget", () => {
  test("restores the stored previous state", () => {
    expect(reinstatementTarget("REMOVED", "COMPLETED")).toBe("COMPLETED");
    expect(reinstatementTarget("REMOVED", "APPROVED")).toBe("APPROVED");
  });

  test("falls back to approved when no previous state is stored", () => {
    expect(reinstatementTarget("REMOVED", null)).toBe("APPROVED");
  });

  test("refuses an enrollment that is not removed", () => {
    expect(() => reinstatementTarget("APPROVED", null)).toThrow(
      expect.objectContaining({ code: "ENROLLMENT_NOT_REMOVED" }),
    );
  });
});
