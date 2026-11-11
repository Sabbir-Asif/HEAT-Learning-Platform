import { getCertificatesDownloadUrl } from "@heat/api-client";
import type { CertificateItem, DashboardCourse } from "@heat/contracts";
import type { CertificateCardStatus } from "@heat/ui";

export const certificatesPath = "/certificates";

export interface CertificateCardModel {
  key: string;
  courseTitle: string;
  status: CertificateCardStatus;
  number?: string;
  issuedLabel?: string;
  verificationUrl?: string;
  downloadHref?: string;
}

const statusOf: Record<CertificateItem["status"], CertificateCardStatus> = {
  READY: "ready",
  PENDING: "pending",
  REVOKED: "revoked",
};

const issuedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export const formatIssuedDate = (iso: string): string => issuedFormat.format(new Date(iso));

export const toCertificateCardModel = (item: CertificateItem): CertificateCardModel => {
  const status = statusOf[item.status];
  return {
    key: item.id ?? `pending-${item.courseId}`,
    courseTitle: item.courseTitle,
    status,
    ...(item.number === null ? {} : { number: item.number }),
    ...(item.issuedAt === null ? {} : { issuedLabel: formatIssuedDate(item.issuedAt) }),
    ...(status === "ready" && item.verificationUrl !== null
      ? { verificationUrl: item.verificationUrl }
      : {}),
    ...(status === "ready" && item.id !== null
      ? { downloadHref: getCertificatesDownloadUrl(item.id) }
      : {}),
  };
};

export type DashboardCertificateState =
  | { kind: "ready"; viewHref: string; downloadHref: string }
  | { kind: "pending" }
  | { kind: "revoked" };

export const dashboardCertificateOf = (
  course: DashboardCourse,
): DashboardCertificateState | null => {
  if (course.status !== "COMPLETED" || course.certificate === null) return null;
  const { id, status } = course.certificate;
  if (status === "REVOKED") return { kind: "revoked" };
  if (status === "READY" && id !== null) {
    return {
      kind: "ready",
      viewHref: certificatesPath,
      downloadHref: getCertificatesDownloadUrl(id),
    };
  }
  return { kind: "pending" };
};
