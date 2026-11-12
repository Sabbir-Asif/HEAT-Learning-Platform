import type { CertificateListResponse, CertificateVerificationResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { APP_CONFIG, DATABASE } from "../core";
import type { AppConfig } from "../core";
import {
  decideDownload,
  downloadHeaders,
  toCertificateItems,
  toVerification,
} from "./certificate-rules";
import type { DownloadViewer } from "./certificate-rules";

@Injectable()
export class CertificatesService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  async listFor(userId: string): Promise<CertificateListResponse> {
    const rows = await this.database.enrollment.findMany({
      where: {
        userId,
        deletedAt: null,
        course: { deletedAt: null },
        OR: [{ status: "COMPLETED" }, { certificate: { isNot: null } }],
      },
      orderBy: { requestedAt: "asc" },
      select: {
        status: true,
        course: { select: { id: true, title: true } },
        certificate: {
          select: { id: true, number: true, fileKey: true, revokedAt: true, issuedAt: true },
        },
      },
    });
    return { certificates: toCertificateItems(rows, this.config.publicAppUrl) };
  }

  async verify(number: string): Promise<CertificateVerificationResponse> {
    const row = await this.database.certificate.findUnique({
      where: { number },
      select: {
        recipientName: true,
        issuedAt: true,
        fileKey: true,
        revokedAt: true,
        enrollment: {
          select: { completedAt: true, updatedAt: true, course: { select: { title: true } } },
        },
      },
    });
    const verification = toVerification(row);
    if (verification === null) throw new NotFoundException();
    return verification;
  }

  async prepareDownload(
    viewer: Exclude<DownloadViewer, null>,
    certificateId: string,
    actor: AuditActor,
  ): Promise<Record<string, string>> {
    const row = await this.database.certificate.findUnique({
      where: { id: certificateId },
      select: {
        id: true,
        number: true,
        fileKey: true,
        revokedAt: true,
        enrollment: { select: { userId: true } },
      },
    });
    const subject =
      row === null
        ? null
        : { ownerId: row.enrollment.userId, fileKey: row.fileKey, revokedAt: row.revokedAt };
    if (row === null || row.fileKey === null || !decideDownload(viewer, subject)) {
      throw new NotFoundException();
    }
    if (viewer.kind === "admin") {
      await this.audit.recordStandalone(actor, {
        action: "certificate.download",
        entity: "Certificate",
        entityId: row.id,
        after: { ownerId: row.enrollment.userId },
      });
    }
    return downloadHeaders(row.number, row.fileKey);
  }
}
