import { findUserIdsByEmail } from "@heat/db";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable } from "@nestjs/common";
import type { EnrollmentAcceptedResponse, VerificationResendRequest } from "@heat/contracts";
import { ResponseTiming, VerificationSessionService } from "../account-protection";
import { AuditService } from "../audit";
import { hashOpaqueToken } from "../auth";
import type { SessionMetadata, SessionTokens } from "../auth";
import { CaptchaService } from "../captcha";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { CERTIFICATE_REQUESTED_EVENT_TYPE } from "../learning/module-completion.service";
import { VerificationTokenService } from "./verification-token.service";
import {
  EMAIL_VERIFIED_AUDIT_ACTION,
  VERIFICATION_EMAIL_TEMPLATE,
  VERIFICATION_PURPOSE,
  VERIFICATION_RESEND_EVENT_TYPE,
  classifyToken,
} from "./verification-token";
import type { TokenFailure } from "./verification-token";

export type ConfirmedVerification = { userId: string; tokens: SessionTokens };

const accepted: EnrollmentAcceptedResponse = { accepted: true };

const failures: Record<TokenFailure, () => ApiException> = {
  invalid: () => new ApiException(404, "VERIFICATION_LINK_INVALID"),
  used: () => new ApiException(409, "VERIFICATION_LINK_USED"),
  expired: () => new ApiException(410, "VERIFICATION_LINK_EXPIRED"),
};

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly tokens: VerificationTokenService,
    private readonly sessions: VerificationSessionService,
    private readonly captcha: CaptchaService,
    private readonly audit: AuditService,
    private readonly timing: ResponseTiming,
  ) {}

  async confirm(
    token: string,
    metadata: SessionMetadata & { requestId?: string },
  ): Promise<ConfirmedVerification> {
    const tokenHash = hashOpaqueToken(token);
    const userId = await this.database.$transaction(async (tx) => {
      const now = this.clock.now();
      const claimed = await tx.authToken.updateMany({
        where: { tokenHash, purpose: VERIFICATION_PURPOSE, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      const row = await tx.authToken.findUnique({
        where: { tokenHash },
        select: { userId: true, purpose: true, usedAt: true, expiresAt: true },
      });
      if (claimed.count !== 1 || row === null) throw failures[classifyToken(row, now)]();
      const at = this.sessions.verificationTimestamp();
      const verified = await tx.user.updateMany({
        where: {
          id: row.userId,
          realm: "STUDENT",
          deletedAt: null,
          deactivatedAt: null,
          emailVerifiedAt: null,
        },
        data: { emailVerifiedAt: at },
      });
      if (verified.count !== 1) throw failures.invalid();
      await tx.enrollment.updateMany({
        where: { userId: row.userId, status: "PENDING_VERIFICATION", deletedAt: null },
        data: { status: "PENDING_APPROVAL", verifiedAt: at },
      });
      const held = await tx.enrollment.findMany({
        where: { userId: row.userId, status: "COMPLETED", deletedAt: null, certificate: null },
        select: { id: true, courseId: true },
      });
      for (const enrollment of held) {
        await tx.outbox.create({
          data: {
            eventType: CERTIFICATE_REQUESTED_EVENT_TYPE,
            payload: {
              enrollmentId: enrollment.id,
              userId: row.userId,
              courseId: enrollment.courseId,
            },
          },
        });
      }
      await this.sessions.revokeSessionsBeforeVerification(row.userId, at, tx);
      await this.audit.record(
        tx,
        { actorId: row.userId, ipAddress: metadata.ipAddress, requestId: metadata.requestId },
        {
          action: EMAIL_VERIFIED_AUDIT_ACTION,
          entity: "User",
          entityId: row.userId,
          before: { status: "UNVERIFIED" },
          after: { status: "VERIFIED" },
        },
      );
      return row.userId;
    });
    const tokens = await this.sessions.issueSessionAfterCommit(userId, {
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    });
    return { userId, tokens };
  }

  async resend(request: VerificationResendRequest): Promise<EnrollmentAcceptedResponse> {
    await this.captcha.verify(request.captchaId, request.captchaAnswer);
    return this.timing.equalise(async () => {
      await this.database.$transaction((tx) => this.queueResend(tx, request.email));
      return accepted;
    });
  }

  private async queueResend(
    tx: Pick<HeatClient, "$executeRaw" | "$queryRaw" | "user" | "authToken" | "outbox">,
    email: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${email})))`;
    const user = await tx.user.findFirst({
      where: {
        id: { in: await findUserIdsByEmail(tx, email) },
        realm: "STUDENT",
        deletedAt: null,
        deactivatedAt: null,
        emailVerifiedAt: null,
      },
      select: { id: true, createdAt: true },
    });
    if (user === null) return;
    if (await this.tokens.resendsExhausted(tx, user.id)) {
      throw new ApiException(429, "VERIFICATION_RESEND_LIMIT");
    }
    const issued = await this.tokens.issue(tx, user);
    if (issued === null) return;
    await tx.outbox.create({
      data: {
        eventType: VERIFICATION_RESEND_EVENT_TYPE,
        payload: {
          template: VERIFICATION_EMAIL_TEMPLATE,
          userId: user.id,
          encryptedToken: issued.encryptedToken,
        },
      },
    });
  }
}
