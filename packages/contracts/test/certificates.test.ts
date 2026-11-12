import { describe, expect, test } from "vitest";
import {
  certificateItemSchema,
  certificateListResponseSchema,
  certificateVerificationResponseSchema,
  certificateVerifyParamsSchema,
  dashboardCertificateSchema,
  reissueCertificateRequestSchema,
  revokeCertificateRequestSchema,
} from "../src";

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const ready = {
  id,
  courseId: id,
  courseTitle: "HEAT",
  status: "READY",
  number: "ABCD-EFGH-JKMN",
  issuedAt: "2026-11-12T10:00:00.000Z",
  verificationUrl: "https://learn.example/verify/ABCD-EFGH-JKMN",
};

describe("certificate contracts", () => {
  test("accepts a ready certificate and a pending placeholder", () => {
    expect(certificateItemSchema.safeParse(ready).success).toBe(true);
    expect(
      certificateListResponseSchema.safeParse({
        certificates: [
          {
            ...ready,
            id: null,
            status: "PENDING",
            number: null,
            issuedAt: null,
            verificationUrl: null,
          },
        ],
      }).success,
    ).toBe(true);
  });

  test("rejects an unknown status", () => {
    expect(certificateItemSchema.safeParse({ ...ready, status: "LOST" }).success).toBe(false);
  });

  test("dashboard certificate carries an id and a status", () => {
    expect(dashboardCertificateSchema.safeParse({ id, status: "READY" }).success).toBe(true);
    expect(dashboardCertificateSchema.safeParse({ id: null, status: "PENDING" }).success).toBe(
      true,
    );
  });
});

describe("certificate verification and admin action contracts", () => {
  test("a verification number is trimmed and upper-cased", () => {
    const parsed = certificateVerifyParamsSchema.parse({ number: " abcd-efgh-jkmn " });
    expect(parsed.number).toBe("ABCD-EFGH-JKMN");
  });

  test("a verification number with other characters or no length is refused", () => {
    expect(certificateVerifyParamsSchema.safeParse({ number: "AB CD" }).success).toBe(false);
    expect(certificateVerifyParamsSchema.safeParse({ number: "../etc" }).success).toBe(false);
    expect(certificateVerifyParamsSchema.safeParse({ number: "  " }).success).toBe(false);
    expect(certificateVerifyParamsSchema.safeParse({ number: "A".repeat(65) }).success).toBe(false);
  });

  test("the verification response carries only status, name, course and date", () => {
    const parsed = certificateVerificationResponseSchema.parse({
      status: "VALID",
      holderName: "Rahim",
      courseTitle: "HEAT",
      completedAt: "2026-11-12T10:00:00.000Z",
      email: "leak@example.com",
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "completedAt",
      "courseTitle",
      "holderName",
      "status",
    ]);
  });

  test("revoke and reissue require a reason that is trimmed", () => {
    expect(revokeCertificateRequestSchema.safeParse({ reason: "  " }).success).toBe(false);
    expect(reissueCertificateRequestSchema.safeParse({}).success).toBe(false);
    expect(revokeCertificateRequestSchema.parse({ reason: " fraud " }).reason).toBe("fraud");
    expect(reissueCertificateRequestSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(
      false,
    );
  });
});
