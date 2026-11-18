import { describe, expect, test } from "vitest";
import {
  certificateStatusOf,
  decideDownload,
  downloadHeaders,
  isCertificateFileKey,
  reissueRefusal,
  reissuedRecipientName,
  revokeRefusal,
  safeFilenameNumber,
  toCertificateItems,
  toVerification,
  verificationUrlOf,
} from "../../src/certificates/certificate-rules";

const key = `${"a1".repeat(32)}.pdf`;
const issuedAt = new Date("2026-11-12T10:00:00.000Z");
const certificate = (overrides: object = {}) => ({
  id: "c1",
  ownerId: "u1",
  fileKey: key,
  revokedAt: null,
  ...overrides,
});

describe("isCertificateFileKey", () => {
  test("accepts 64 hex characters with the pdf extension only", () => {
    expect(isCertificateFileKey(key)).toBe(true);
    expect(isCertificateFileKey("../etc/passwd")).toBe(false);
    expect(isCertificateFileKey(`${"A1".repeat(32)}.pdf`)).toBe(false);
    expect(isCertificateFileKey(`${key}\n`)).toBe(false);
    expect(isCertificateFileKey(`x${key}`)).toBe(false);
  });
});

describe("certificateStatusOf", () => {
  test("is pending without a row or without a stored file", () => {
    expect(certificateStatusOf(null)).toBe("PENDING");
    expect(certificateStatusOf({ fileKey: null, revokedAt: null })).toBe("PENDING");
  });

  test("is ready with a file and revoked once revoked", () => {
    expect(certificateStatusOf({ fileKey: key, revokedAt: null })).toBe("READY");
    expect(certificateStatusOf({ fileKey: key, revokedAt: issuedAt })).toBe("REVOKED");
    expect(certificateStatusOf({ fileKey: null, revokedAt: issuedAt })).toBe("REVOKED");
  });
});

describe("decideDownload", () => {
  test("allows the owner of a ready certificate", () => {
    expect(decideDownload({ kind: "student", userId: "u1" }, certificate())).toBe(true);
  });

  test("denies another student, anonymous callers and a missing certificate", () => {
    expect(decideDownload({ kind: "student", userId: "u2" }, certificate())).toBe(false);
    expect(decideDownload(null, certificate())).toBe(false);
    expect(decideDownload({ kind: "student", userId: "u1" }, null)).toBe(false);
  });

  test("denies the owner when revoked or not ready", () => {
    expect(
      decideDownload({ kind: "student", userId: "u1" }, certificate({ revokedAt: issuedAt })),
    ).toBe(false);
    expect(decideDownload({ kind: "student", userId: "u1" }, certificate({ fileKey: null }))).toBe(
      false,
    );
  });

  test("allows an admin for any stored file, revoked included, but not when not ready", () => {
    expect(decideDownload({ kind: "admin" }, certificate({ ownerId: "other" }))).toBe(true);
    expect(decideDownload({ kind: "admin" }, certificate({ revokedAt: issuedAt }))).toBe(true);
    expect(decideDownload({ kind: "admin" }, certificate({ fileKey: null }))).toBe(false);
  });

  test("denies a stored key that does not match the pattern", () => {
    expect(decideDownload({ kind: "admin" }, certificate({ fileKey: "../x.pdf" }))).toBe(false);
  });
});

describe("downloadHeaders", () => {
  test("builds the accel redirect and attachment headers", () => {
    expect(downloadHeaders("ABCD-EFGH-JKMN", key)).toEqual({
      "X-Accel-Redirect": `/internal/certificates/${key}`,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="wsap-certificate-ABCD-EFGH-JKMN.pdf"',
      "Cache-Control": "private, no-store",
    });
  });

  test("refuses a key that is not a stored certificate", () => {
    expect(() => downloadHeaders("N1", "../secret")).toThrow();
  });

  test("sanitises the number in the file name", () => {
    expect(safeFilenameNumber('AB"CD\r\n-1')).toBe("ABCD-1");
    expect(safeFilenameNumber("\r\n")).toBe("certificate");
  });
});

describe("verificationUrlOf", () => {
  test("joins the public origin and the encoded number", () => {
    expect(verificationUrlOf("https://learn.example", "AB-1")).toBe(
      "https://learn.example/verify/AB-1",
    );
    expect(verificationUrlOf("https://learn.example/", "A B")).toBe(
      "https://learn.example/verify/A%20B",
    );
  });
});

describe("toCertificateItems", () => {
  const enrollment = (overrides: object = {}) => ({
    status: "COMPLETED",
    course: { id: "k1", title: "HEAT" },
    certificate: null,
    ...overrides,
  });

  test("maps a ready certificate", () => {
    const [item] = toCertificateItems(
      [
        enrollment({
          certificate: { id: "c1", number: "N1", fileKey: key, revokedAt: null, issuedAt },
        }),
      ],
      "https://learn.example",
    );
    expect(item).toEqual({
      id: "c1",
      courseId: "k1",
      courseTitle: "HEAT",
      status: "READY",
      number: "N1",
      issuedAt: "2026-11-12T10:00:00.000Z",
      verificationUrl: "https://learn.example/verify/N1",
    });
  });

  test("a completed enrollment without a stored file is a placeholder with no number", () => {
    const items = toCertificateItems(
      [
        enrollment(),
        enrollment({
          certificate: { id: "c2", number: "N2", fileKey: null, revokedAt: null, issuedAt },
        }),
      ],
      "https://learn.example",
    );
    expect(items.map((i) => [i.id, i.status, i.number, i.verificationUrl, i.issuedAt])).toEqual([
      [null, "PENDING", null, null, null],
      [null, "PENDING", null, null, null],
    ]);
  });

  test("keeps a removed student's certificate and marks a revoked one", () => {
    const items = toCertificateItems(
      [
        enrollment({
          status: "REMOVED",
          certificate: { id: "c1", number: "N1", fileKey: key, revokedAt: null, issuedAt },
        }),
        enrollment({
          certificate: { id: "c3", number: "N3", fileKey: key, revokedAt: issuedAt, issuedAt },
        }),
      ],
      "https://learn.example",
    );
    expect(items.map((i) => i.status)).toEqual(["READY", "REVOKED"]);
  });

  test("skips enrollments that are not completed and have no certificate", () => {
    expect(
      toCertificateItems([enrollment({ status: "APPROVED" })], "https://learn.example"),
    ).toEqual([]);
  });
});

describe("certificate verification and admin refusals", () => {
  const verifiable = (overrides: object = {}) => ({
    recipientName: "Rahim Uddin",
    issuedAt,
    fileKey: key,
    revokedAt: null,
    enrollment: {
      completedAt: new Date("2026-11-10T00:00:00.000Z"),
      updatedAt: new Date("2026-11-11T00:00:00.000Z"),
      course: { title: "HEAT" },
    },
    ...overrides,
  });

  test("a valid certificate exposes status, name, course and completion date only", () => {
    expect(toVerification(verifiable())).toEqual({
      status: "VALID",
      holderName: "Rahim Uddin",
      courseTitle: "HEAT",
      completedAt: "2026-11-10T00:00:00.000Z",
    });
  });

  test("a revoked certificate is reported as revoked", () => {
    expect(toVerification(verifiable({ revokedAt: issuedAt }))?.status).toBe("REVOKED");
  });

  test("a certificate revoked before its file was rendered is still reported as revoked", () => {
    expect(toVerification(verifiable({ fileKey: null, revokedAt: issuedAt }))?.status).toBe(
      "REVOKED",
    );
  });

  test("an unknown certificate is not found", () => {
    expect(toVerification(null)).toBeNull();
  });

  test("an issued certificate stays valid while a reissue regenerates its file", () => {
    expect(toVerification(verifiable({ fileKey: null }))?.status).toBe("VALID");
  });

  test("the completion date falls back to the enrollment update time", () => {
    const fallback = verifiable({
      enrollment: {
        completedAt: null,
        updatedAt: new Date("2026-11-11T00:00:00.000Z"),
        course: { title: "HEAT" },
      },
    });
    expect(toVerification(fallback)?.completedAt).toBe("2026-11-11T00:00:00.000Z");
  });

  test("a revoked certificate cannot be revoked again", () => {
    expect(revokeRefusal({ fileKey: key, revokedAt: null })).toBeNull();
    expect(revokeRefusal({ fileKey: key, revokedAt: issuedAt })?.code).toBe("CERTIFICATE_REVOKED");
  });

  test("only a rendered, unrevoked certificate can be reissued", () => {
    expect(reissueRefusal({ fileKey: key, revokedAt: null })).toBeNull();
    expect(reissueRefusal({ fileKey: key, revokedAt: issuedAt })?.code).toBe("CERTIFICATE_REVOKED");
    expect(reissueRefusal({ fileKey: null, revokedAt: null })?.code).toBe("CERTIFICATE_NOT_READY");
  });

  test("a reissue takes the current profile name and keeps the old one when it is blank", () => {
    expect(reissuedRecipientName("Old Name", " New Name ")).toBe("New Name");
    expect(reissuedRecipientName("Old Name", "  ")).toBe("Old Name");
    expect(reissuedRecipientName("Old Name", null)).toBe("Old Name");
  });
});
