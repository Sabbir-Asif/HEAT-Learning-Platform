import { describe, expect, test } from "vitest";
import { approvalRefusal, isStudentProfileLocked } from "../../src/enrollment/approval-rules";

describe("approvalRefusal", () => {
  test("allows only a verified pending request", () => {
    expect(approvalRefusal("PENDING_APPROVAL")).toBeNull();
  });

  test("refuses an unverified request with its own code", () => {
    expect(approvalRefusal("PENDING_VERIFICATION")).toMatchObject({
      code: "ENROLLMENT_NOT_VERIFIED",
    });
  });

  test.each(["APPROVED", "COMPLETED", "REJECTED", "EXPIRED", "REMOVED"] as const)(
    "reports %s as already decided with a conflict status",
    (status) => {
      const refusal = approvalRefusal(status);
      expect(refusal).toMatchObject({ code: "ENROLLMENT_ALREADY_DECIDED" });
      expect(refusal?.getStatus()).toBe(409);
    },
  );
});

describe("isStudentProfileLocked", () => {
  test("is locked once any enrollment of the student was approved", async () => {
    const client = { enrollment: { count: async () => 1 } };
    await expect(isStudentProfileLocked(client as never, "user-id")).resolves.toBe(true);
  });

  test("stays open before the first approval", async () => {
    const count = async () => 0;
    await expect(isStudentProfileLocked({ enrollment: { count } } as never, "u")).resolves.toBe(
      false,
    );
  });
});
