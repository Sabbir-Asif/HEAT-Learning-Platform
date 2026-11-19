import type { CertificateItem, DashboardCourse } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  dashboardCertificateOf,
  formatIssuedDate,
  toCertificateCardModel,
} from "../../src/certificates/certificate-view";

const id = "0198f1a0-0000-7000-8000-0000000000a1";

const item = (overrides: Partial<CertificateItem> = {}): CertificateItem => ({
  id,
  courseId: id,
  courseTitle: "HEAT",
  status: "READY",
  number: "AB-1",
  issuedAt: "2026-11-12T10:00:00.000Z",
  verificationUrl: "https://learn.example/verify/AB-1",
  ...overrides,
});

const course = (overrides: Partial<DashboardCourse> = {}): DashboardCourse => ({
  courseId: id,
  courseSlug: "heat",
  courseTitle: "HEAT",
  thumbnail: null,
  status: "COMPLETED",
  reason: null,
  progress: null,
  nextModule: null,
  certificate: { id, status: "READY" },
  ...overrides,
});

describe("formatIssuedDate", () => {
  test("uses the Dhaka calendar day", () => {
    expect(formatIssuedDate("2026-11-12T20:00:00.000Z")).toBe("13 November 2026");
  });
});

describe("toCertificateCardModel", () => {
  test("a ready certificate carries the link, number, date and download url", () => {
    expect(toCertificateCardModel(item())).toEqual({
      key: id,
      courseTitle: "HEAT",
      status: "ready",
      number: "AB-1",
      issuedLabel: "12 November 2026",
      verificationUrl: "https://learn.example/verify/AB-1",
      downloadHref: `/api/certificates/${id}/download`,
    });
  });

  test("a pending placeholder has no number, link or download", () => {
    expect(
      toCertificateCardModel(
        item({ id: null, status: "PENDING", number: null, issuedAt: null, verificationUrl: null }),
      ),
    ).toEqual({ key: `pending-${id}`, courseTitle: "HEAT", status: "pending" });
  });

  test("a revoked certificate shows its number but offers no link or download", () => {
    const model = toCertificateCardModel(item({ status: "REVOKED" }));

    expect(model.status).toBe("revoked");
    expect(model.number).toBe("AB-1");
    expect(model.downloadHref).toBeUndefined();
    expect(model.verificationUrl).toBeUndefined();
  });
});

describe("dashboardCertificateOf", () => {
  test("ready links to the certificates page and the download", () => {
    expect(dashboardCertificateOf(course())).toEqual({
      kind: "ready",
      viewHref: "/certificates",
      downloadHref: `/api/certificates/${id}/download`,
    });
  });

  test("pending and revoked have no links", () => {
    expect(
      dashboardCertificateOf(course({ certificate: { id: null, status: "PENDING" } })),
    ).toEqual({ kind: "pending" });
    expect(dashboardCertificateOf(course({ certificate: { id, status: "REVOKED" } }))).toEqual({
      kind: "revoked",
    });
  });

  test("is null for a course that is not completed or has no state", () => {
    expect(dashboardCertificateOf(course({ status: "APPROVED" }))).toBeNull();
    expect(dashboardCertificateOf(course({ certificate: null }))).toBeNull();
  });
});
