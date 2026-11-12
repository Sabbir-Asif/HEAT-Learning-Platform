import type { HeatClient } from "@heat/db";
import type { CertificateFileLookup, CertificateFileRecord } from "./certificate-attachment";

export class PrismaCertificateFileLookup implements CertificateFileLookup {
  constructor(private readonly database: HeatClient) {}

  findByNumber(number: string): Promise<CertificateFileRecord | null> {
    return this.database.certificate.findUnique({
      where: { number },
      select: { number: true, fileKey: true, fileSha256: true, revokedAt: true },
    });
  }
}
