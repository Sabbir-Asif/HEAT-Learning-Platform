import { describe, expect, test } from "vitest";
import {
  approvalQueueQuerySchema,
  approveEnrollmentsRequestSchema,
  errorCodes,
  maxBulkApprovals,
  rejectEnrollmentRequestSchema,
  rejectEnrollmentsRequestSchema,
  rejectionReasonPresets,
} from "../src/index";

const id = "0192f2a0-7c1e-7b3a-8d4e-5f6a7b8c9d0e";
const other = "0192f2a0-7c1e-7b3a-8d4e-5f6a7b8c9d0f";

describe("approvalQueueQuerySchema", () => {
  test("defaults to oldest first on page one", () => {
    const parsed = approvalQueueQuerySchema.parse({});
    expect(parsed).toMatchObject({ sort: "requestedAt", page: 1, pageSize: 25 });
  });

  test("accepts every filter", () => {
    const parsed = approvalQueueQuerySchema.parse({
      courseId: id,
      universityId: id,
      facultyId: id,
      departmentId: id,
      session: "2020-21",
      submittedFrom: "2026-11-01",
      submittedTo: "2026-11-30",
      sort: "-requestedAt",
      page: "2",
      pageSize: "50",
    });
    expect(parsed.page).toBe(2);
    expect(parsed.sort).toBe("-requestedAt");
  });

  test("rejects a malformed date and an inverted range", () => {
    expect(approvalQueueQuerySchema.safeParse({ submittedFrom: "01/11/2026" }).success).toBe(false);
    expect(
      approvalQueueQuerySchema.safeParse({
        submittedFrom: "2026-11-30",
        submittedTo: "2026-11-01",
      }).success,
    ).toBe(false);
  });

  test("rejects an unknown sort", () => {
    expect(approvalQueueQuerySchema.safeParse({ sort: "name" }).success).toBe(false);
  });
});

describe("approveEnrollmentsRequestSchema", () => {
  test("requires at least one id and no duplicates", () => {
    expect(approveEnrollmentsRequestSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(approveEnrollmentsRequestSchema.safeParse({ ids: [id, id] }).success).toBe(false);
    expect(approveEnrollmentsRequestSchema.safeParse({ ids: [id, other] }).success).toBe(true);
  });

  test("caps the batch size", () => {
    const ids = Array.from(
      { length: maxBulkApprovals + 1 },
      (_, index) => `0192f2a0-7c1e-7b3a-8d4e-${String(index).padStart(12, "0")}`,
    );
    expect(approveEnrollmentsRequestSchema.safeParse({ ids }).success).toBe(false);
  });

  test("trims the reason and treats blank as absent", () => {
    expect(approveEnrollmentsRequestSchema.parse({ ids: [id], reason: "  ok  " }).reason).toBe(
      "ok",
    );
    expect(approveEnrollmentsRequestSchema.parse({ ids: [id], reason: "   " }).reason).toBe(
      undefined,
    );
  });

  test("limits the reason length", () => {
    expect(
      approveEnrollmentsRequestSchema.safeParse({ ids: [id], reason: "x".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("approval error codes", () => {
  test("are published", () => {
    expect(errorCodes).toContain("ENROLLMENT_NOT_VERIFIED");
    expect(errorCodes).toContain("ENROLLMENT_ALREADY_DECIDED");
  });
});

describe("rejection requests", () => {
  test("offer presets that fit the reason limit", () => {
    expect(rejectionReasonPresets.length).toBeGreaterThan(0);
    for (const preset of rejectionReasonPresets) {
      expect(rejectEnrollmentRequestSchema.safeParse({ reason: preset }).success).toBe(true);
    }
  });

  test("treat the reason as optional and trim it", () => {
    expect(rejectEnrollmentRequestSchema.parse({}).reason).toBeUndefined();
    expect(rejectEnrollmentRequestSchema.parse({ reason: "  no  " }).reason).toBe("no");
    expect(rejectEnrollmentRequestSchema.parse({ reason: "  " }).reason).toBeUndefined();
  });

  test("reject over-long reasons", () => {
    expect(rejectEnrollmentRequestSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(
      false,
    );
  });

  test("bulk request needs unique ids within the limit", () => {
    expect(rejectEnrollmentsRequestSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(rejectEnrollmentsRequestSchema.safeParse({ ids: [id, id] }).success).toBe(false);
    expect(
      rejectEnrollmentsRequestSchema.safeParse({ ids: [id, other], reason: "no" }).success,
    ).toBe(true);
    const ids = Array.from(
      { length: maxBulkApprovals + 1 },
      (_, index) => `0192f2a0-7c1e-7b3a-8d4e-${String(index).padStart(12, "0")}`,
    );
    expect(rejectEnrollmentsRequestSchema.safeParse({ ids }).success).toBe(false);
  });
});
