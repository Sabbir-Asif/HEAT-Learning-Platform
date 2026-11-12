import { createHash } from "node:crypto";
import type { MailAttachment } from "api/core";

export const CERTIFICATE_READY_TEMPLATE = "certificate-ready";

export class AttachmentUnavailable extends Error {}

export interface CertificateFileRecord {
  number: string;
  fileKey: string | null;
  fileSha256: string | null;
  revokedAt: Date | null;
}

export interface CertificateFileLookup {
  findByNumber(number: string): Promise<CertificateFileRecord | null>;
}

export interface CertificateFileReader {
  read(key: string): Promise<Uint8Array>;
}

export interface EmailAttachmentSource {
  load(template: string, payload: unknown): Promise<MailAttachment[]>;
}

const certificateCodeOf = (payload: unknown): string | null => {
  if (typeof payload !== "object" || payload === null) return null;
  const code: unknown = Reflect.get(payload, "certificateCode");
  return typeof code === "string" && code.length > 0 ? code : null;
};

const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

export class CertificateAttachmentSource implements EmailAttachmentSource {
  constructor(
    private readonly lookup: CertificateFileLookup,
    private readonly reader: CertificateFileReader,
  ) {}

  async load(template: string, payload: unknown): Promise<MailAttachment[]> {
    if (template !== CERTIFICATE_READY_TEMPLATE) return [];
    const code = certificateCodeOf(payload);
    if (code === null) throw new AttachmentUnavailable("certificate code missing");
    const record = await this.lookup.findByNumber(code);
    if (record === null) throw new AttachmentUnavailable("certificate not found");
    if (record.revokedAt !== null) throw new AttachmentUnavailable("certificate revoked");
    if (record.fileKey === null || record.fileSha256 === null) {
      throw new AttachmentUnavailable("certificate file not stored");
    }
    const content = await this.reader
      .read(record.fileKey)
      .catch(() => Promise.reject(new AttachmentUnavailable("certificate file unreadable")));
    if (sha256Of(content) !== record.fileSha256) {
      throw new AttachmentUnavailable("certificate file checksum mismatch");
    }
    return [
      {
        filename: `HEAT-certificate-${record.number}.pdf`,
        content: Buffer.from(content),
        contentType: "application/pdf",
      },
    ];
  }
}
