import { describe, expect, test } from "vitest";
import {
  certificateItemSchema,
  certificateListResponseSchema,
  dashboardCertificateSchema,
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
