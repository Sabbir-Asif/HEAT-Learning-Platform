import type { ExistingCertificate } from "./issue-rules";

export interface CertificateSource {
  enrollmentId: string;
  userId: string;
  courseId: string;
  courseTitle: string;
  holderName: string;
  enrollmentStatus: string;
  emailVerified: boolean;
  completedAt: Date;
  certificate: ExistingCertificate | null;
}

export interface NewCertificate {
  enrollmentId: string;
  number: string;
  recipientName: string;
  issuedAt: Date;
}

export type CreateOutcome =
  | { outcome: "created"; certificate: ExistingCertificate }
  | { outcome: "duplicate" }
  | { outcome: "number-taken" };

export interface StoredFile {
  key: string;
  sha256: string;
  sizeBytes: number;
}

export interface IssuedEvent {
  certificateId: string;
  enrollmentId: string;
  userId: string;
  courseTitle: string;
  number: string;
}

export interface CertificateStore {
  load(enrollmentId: string): Promise<CertificateSource | null>;
  create(certificate: NewCertificate): Promise<CreateOutcome>;
  finalise(certificateId: string, file: StoredFile, event: IssuedEvent): Promise<boolean>;
}

export interface PdfRenderer {
  render(html: string): Promise<Uint8Array>;
}

export interface CertificateStorage {
  save(bytes: Uint8Array): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

export interface CertificateLog {
  info(event: string, fields: Record<string, string>): void;
  error(event: string, fields: Record<string, string>): void;
}
