import type { HeatClient } from "@heat/db";
import type {
  CertificateSource,
  CertificateStore,
  CreateOutcome,
  IssuedEvent,
  NewCertificate,
  StoredFile,
} from "./certificate-ports";

export const CERTIFICATE_ISSUED_EVENT_TYPE = "certificate.issued";
export const CERTIFICATE_EMAIL_TEMPLATE = "certificate-ready";
export const CERTIFICATE_READY_NOTIFICATION = "CERTIFICATE_READY";

const certificateSelect = {
  id: true,
  number: true,
  recipientName: true,
  fileKey: true,
  fileSha256: true,
  fileSizeBytes: true,
  revokedAt: true,
} as const;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export const issuedEventPayload = (event: IssuedEvent) => ({
  template: CERTIFICATE_EMAIL_TEMPLATE,
  userId: event.userId,
  courseTitle: event.courseTitle,
  certificateCode: event.number,
  notification: {
    type: CERTIFICATE_READY_NOTIFICATION,
    data: { certificateId: event.certificateId, enrollmentId: event.enrollmentId },
  },
});

export class PrismaCertificateStore implements CertificateStore {
  constructor(private readonly database: HeatClient) {}

  async load(enrollmentId: string): Promise<CertificateSource | null> {
    const enrollment = await this.database.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        userId: true,
        courseId: true,
        status: true,
        completedAt: true,
        updatedAt: true,
        course: { select: { title: true } },
        user: { select: { emailVerifiedAt: true, profile: { select: { name: true } } } },
        certificate: { select: certificateSelect },
      },
    });
    if (enrollment === null) return null;
    return {
      enrollmentId: enrollment.id,
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      courseTitle: enrollment.course.title,
      holderName: enrollment.user.profile?.name ?? "",
      enrollmentStatus: enrollment.status,
      emailVerified: enrollment.user.emailVerifiedAt !== null,
      completedAt: enrollment.completedAt ?? enrollment.updatedAt,
      certificate: enrollment.certificate,
    };
  }

  async create(certificate: NewCertificate): Promise<CreateOutcome> {
    try {
      const created = await this.database.certificate.create({
        data: certificate,
        select: certificateSelect,
      });
      return { outcome: "created", certificate: created };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.database.certificate.findUnique({
        where: { enrollmentId: certificate.enrollmentId },
        select: { id: true },
      });
      return existing === null ? { outcome: "number-taken" } : { outcome: "duplicate" };
    }
  }

  finalise(certificateId: string, file: StoredFile, event: IssuedEvent): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const updated = await tx.certificate.updateMany({
        where: {
          id: certificateId,
          OR: [{ fileKey: null }, { fileSha256: null }, { fileSizeBytes: null }],
        },
        data: { fileKey: file.key, fileSha256: file.sha256, fileSizeBytes: file.sizeBytes },
      });
      if (updated.count === 0) return false;
      await tx.outbox.create({
        data: { eventType: CERTIFICATE_ISSUED_EVENT_TYPE, payload: issuedEventPayload(event) },
      });
      return true;
    });
  }
}
