import type { ReissuedCertificate, RevokedCertificate } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable } from "@nestjs/common";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { reissueRefusal, reissuedRecipientName, revokeRefusal } from "./certificate-rules";

export const CERTIFICATE_REQUESTED_EVENT_TYPE = "certificate.requested";

const certificateSelect = {
  id: true,
  number: true,
  enrollmentId: true,
  recipientName: true,
  fileKey: true,
  fileSha256: true,
  revokedAt: true,
} as const;

@Injectable()
export class CertificateAdminService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  revoke(id: string, actor: AuditActor, reason: string): Promise<RevokedCertificate> {
    return this.database.$transaction(async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id },
        select: certificateSelect,
      });
      if (certificate === null) throw new ApiException(404, "NOT_FOUND");
      const refusal = revokeRefusal(certificate);
      if (refusal !== null) throw refusal;
      const revokedAt = this.clock.now();
      const claimed = await tx.certificate.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt },
      });
      if (claimed.count === 0) throw new ApiException(409, "CERTIFICATE_REVOKED");
      await this.audit.record(tx, actor, {
        action: "certificate.revoke",
        entity: "Certificate",
        entityId: id,
        before: { number: certificate.number, status: "ACTIVE", revokedAt: null },
        after: {
          number: certificate.number,
          status: "REVOKED",
          revokedAt: revokedAt.toISOString(),
          reason,
        },
      });
      return { id, status: "REVOKED" as const, revokedAt: revokedAt.toISOString() };
    });
  }

  reissue(id: string, actor: AuditActor, reason: string): Promise<ReissuedCertificate> {
    return this.database.$transaction(async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id },
        select: {
          ...certificateSelect,
          enrollment: { select: { user: { select: { profile: { select: { name: true } } } } } },
        },
      });
      if (certificate === null) throw new ApiException(404, "NOT_FOUND");
      const refusal = reissueRefusal(certificate);
      if (refusal !== null) throw refusal;
      const recipientName = reissuedRecipientName(
        certificate.recipientName,
        certificate.enrollment.user.profile?.name ?? null,
      );
      const claimed = await tx.certificate.updateMany({
        where: { id, revokedAt: null, fileKey: certificate.fileKey },
        data: { fileKey: null, fileSha256: null, fileSizeBytes: null, recipientName },
      });
      if (claimed.count === 0) throw new ApiException(409, "CERTIFICATE_NOT_READY");
      await tx.outbox.create({
        data: {
          eventType: CERTIFICATE_REQUESTED_EVENT_TYPE,
          payload: { enrollmentId: certificate.enrollmentId },
        },
      });
      await this.audit.record(tx, actor, {
        action: "certificate.reissue",
        entity: "Certificate",
        entityId: id,
        before: {
          number: certificate.number,
          status: "READY",
          recipientName: certificate.recipientName,
          fileSha256: certificate.fileSha256,
        },
        after: {
          number: certificate.number,
          status: "PENDING",
          recipientName,
          reason,
        },
      });
      return { id, status: "PENDING" as const };
    });
  }
}
