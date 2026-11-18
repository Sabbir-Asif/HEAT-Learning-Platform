import type {
  CertificateItem,
  CertificateStatus,
  CertificateVerificationResponse,
} from "@heat/contracts";
import { ApiException } from "../http/api-exception";

export const certificateFileKeyPattern = /^[0-9a-f]{64}\.pdf$/;

export const internalCertificatePrefix = "/internal/certificates/";

export const isCertificateFileKey = (value: string): boolean =>
  certificateFileKeyPattern.test(value);

export interface CertificateFileState {
  fileKey: string | null;
  revokedAt: Date | null;
}

export const certificateStatusOf = (
  certificate: CertificateFileState | null,
): CertificateStatus => {
  if (certificate === null) return "PENDING";
  if (certificate.revokedAt !== null) return "REVOKED";
  return certificate.fileKey === null ? "PENDING" : "READY";
};

export type DownloadViewer = { kind: "student"; userId: string } | { kind: "admin" } | null;

export interface DownloadSubject extends CertificateFileState {
  ownerId: string;
}

export const decideDownload = (
  viewer: DownloadViewer,
  subject: DownloadSubject | null,
): boolean => {
  if (viewer === null || subject === null) return false;
  if (subject.fileKey === null || !isCertificateFileKey(subject.fileKey)) return false;
  if (viewer.kind === "admin") return true;
  return subject.ownerId === viewer.userId && subject.revokedAt === null;
};

export const safeFilenameNumber = (number: string): string => {
  const cleaned = number.replace(/[^A-Za-z0-9-]/g, "");
  return cleaned === "" ? "certificate" : cleaned;
};

export const downloadHeaders = (number: string, fileKey: string): Record<string, string> => {
  if (!isCertificateFileKey(fileKey)) throw new Error("Invalid certificate file key");
  return {
    "X-Accel-Redirect": `${internalCertificatePrefix}${fileKey}`,
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="wsap-certificate-${safeFilenameNumber(number)}.pdf"`,
    "Cache-Control": "private, no-store",
  };
};

export const verificationUrlOf = (publicAppUrl: string, number: string): string =>
  `${new URL(publicAppUrl).origin}/verify/${encodeURIComponent(number)}`;

export interface CertificateEnrollmentRow {
  status: string;
  course: { id: string; title: string };
  certificate: {
    id: string;
    number: string;
    fileKey: string | null;
    revokedAt: Date | null;
    issuedAt: Date;
  } | null;
}

export const toCertificateItems = (
  rows: readonly CertificateEnrollmentRow[],
  publicAppUrl: string,
): CertificateItem[] =>
  rows.flatMap((row): CertificateItem[] => {
    const status = certificateStatusOf(row.certificate);
    const base = { courseId: row.course.id, courseTitle: row.course.title };
    const pending = {
      ...base,
      id: null,
      status: "PENDING" as const,
      number: null,
      issuedAt: null,
      verificationUrl: null,
    };
    if (row.certificate === null) return row.status === "COMPLETED" ? [pending] : [];
    if (status === "PENDING") return [pending];
    return [
      {
        ...base,
        id: row.certificate.id,
        status,
        number: row.certificate.number,
        issuedAt: row.certificate.issuedAt.toISOString(),
        verificationUrl: verificationUrlOf(publicAppUrl, row.certificate.number),
      },
    ];
  });

export interface VerifiableCertificate extends CertificateFileState {
  recipientName: string;
  issuedAt: Date;
  enrollment: { completedAt: Date | null; updatedAt: Date; course: { title: string } };
}

export const toVerification = (
  certificate: VerifiableCertificate | null,
): CertificateVerificationResponse | null => {
  if (certificate === null) return null;
  return {
    status: certificate.revokedAt === null ? "VALID" : "REVOKED",
    holderName: certificate.recipientName,
    courseTitle: certificate.enrollment.course.title,
    completedAt: (
      certificate.enrollment.completedAt ?? certificate.enrollment.updatedAt
    ).toISOString(),
  };
};

export const revokeRefusal = (certificate: CertificateFileState): ApiException | null =>
  certificate.revokedAt === null ? null : new ApiException(409, "CERTIFICATE_REVOKED");

export const reissueRefusal = (certificate: CertificateFileState): ApiException | null => {
  if (certificate.revokedAt !== null) return new ApiException(409, "CERTIFICATE_REVOKED");
  if (certificate.fileKey === null) return new ApiException(409, "CERTIFICATE_NOT_READY");
  return null;
};

export const reissuedRecipientName = (current: string, profileName: string | null): string => {
  const trimmed = profileName?.trim() ?? "";
  return trimmed === "" ? current : trimmed;
};
