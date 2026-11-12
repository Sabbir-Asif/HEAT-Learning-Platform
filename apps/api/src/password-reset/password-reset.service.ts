import { findUserIdsByEmail } from "@heat/db";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EnrollmentAcceptedResponse, ForgotPasswordRequest } from "@heat/contracts";
import { ResponseTiming } from "../account-protection";
import { AuditService } from "../audit";
import { PasswordService, generateOpaqueToken, hashOpaqueToken } from "../auth";
import { CaptchaService } from "../captcha";
import { APP_CONFIG, CLOCK, DATABASE, SecretBox } from "../core";
import type { AppConfig, Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { SignInLockout } from "../rate-limit";
import {
  PASSWORD_RESET_AUDIT_ACTION,
  PASSWORD_RESET_EMAIL_TEMPLATE,
  PASSWORD_RESET_PURPOSE,
  PASSWORD_RESET_REQUEST_EVENT_TYPE,
  capWindowStart,
  classifyResetToken,
  emailCapReached,
  resetExpiry,
} from "./password-reset-rules";
import type { ResetTokenFailure } from "./password-reset-rules";

const accepted: EnrollmentAcceptedResponse = { accepted: true };

const failures: Record<ResetTokenFailure, () => ApiException> = {
  invalid: () => new ApiException(404, "RESET_LINK_INVALID"),
  used: () => new ApiException(409, "RESET_LINK_USED"),
  expired: () => new ApiException(410, "RESET_LINK_EXPIRED"),
};

type RequestTransaction = Pick<
  HeatClient,
  "$executeRaw" | "$queryRaw" | "user" | "authToken" | "outbox"
>;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly captcha: CaptchaService,
    private readonly timing: ResponseTiming,
    private readonly passwords: PasswordService,
    private readonly secretBox: SecretBox,
    private readonly audit: AuditService,
    private readonly lockout: SignInLockout,
  ) {}

  async request(request: ForgotPasswordRequest): Promise<EnrollmentAcceptedResponse> {
    await this.captcha.verify(request.captchaId, request.captchaAnswer);
    return this.timing.equalise(async () => {
      await this.database.$transaction((tx) => this.queueReset(tx, request.email));
      return accepted;
    });
  }

  async reset(
    token: string,
    password: string,
    metadata: { ipAddress?: string; requestId?: string },
  ): Promise<void> {
    const passwordHash = await this.passwords.hashChecked(password);
    const tokenHash = hashOpaqueToken(token);
    const email = await this.database.$transaction(async (tx) => {
      const now = this.clock.now();
      const claimed = await tx.authToken.updateMany({
        where: { tokenHash, purpose: PASSWORD_RESET_PURPOSE, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      const row = await tx.authToken.findUnique({
        where: { tokenHash },
        select: { userId: true, purpose: true, usedAt: true, expiresAt: true },
      });
      if (claimed.count !== 1 || row === null) throw failures[classifyResetToken(row, now)]();
      const updated = await tx.user.updateMany({
        where: {
          id: row.userId,
          realm: "STUDENT",
          deletedAt: null,
          deactivatedAt: null,
          emailVerifiedAt: { not: null },
        },
        data: { passwordHash, mustChangePassword: false },
      });
      if (updated.count !== 1) throw failures.invalid();
      await tx.authToken.updateMany({
        where: { userId: row.userId, purpose: PASSWORD_RESET_PURPOSE, usedAt: null },
        data: { usedAt: now },
      });
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.record(
        tx,
        { actorId: row.userId, ipAddress: metadata.ipAddress, requestId: metadata.requestId },
        {
          action: PASSWORD_RESET_AUDIT_ACTION,
          entity: "User",
          entityId: row.userId,
        },
      );
      const owner = await tx.user.findUnique({
        where: { id: row.userId },
        select: { email: true },
      });
      return owner?.email ?? null;
    });
    if (email !== null) {
      await this.lockout.clearAccount("student", email).catch(() => {
        this.logger.warn("Sign-in lockout could not be cleared after a password reset");
      });
    }
  }

  private async queueReset(tx: RequestTransaction, email: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${email})))`;
    const user = await tx.user.findFirst({
      where: {
        id: { in: await findUserIdsByEmail(tx, email) },
        realm: "STUDENT",
        deletedAt: null,
        deactivatedAt: null,
        emailVerifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (user === null) return;
    const now = this.clock.now();
    const recent = await tx.authToken.count({
      where: {
        userId: user.id,
        purpose: PASSWORD_RESET_PURPOSE,
        createdAt: { gt: capWindowStart(now) },
      },
    });
    if (emailCapReached(recent)) return;
    await tx.authToken.updateMany({
      where: { userId: user.id, purpose: PASSWORD_RESET_PURPOSE, usedAt: null },
      data: { usedAt: now },
    });
    const token = generateOpaqueToken();
    await tx.authToken.create({
      data: {
        userId: user.id,
        purpose: PASSWORD_RESET_PURPOSE,
        tokenHash: hashOpaqueToken(token),
        expiresAt: resetExpiry(now, this.config.passwordReset.ttlMinutes),
      },
    });
    await tx.outbox.create({
      data: {
        eventType: PASSWORD_RESET_REQUEST_EVENT_TYPE,
        payload: {
          template: PASSWORD_RESET_EMAIL_TEMPLATE,
          userId: user.id,
          encryptedToken: this.secretBox.encrypt(token),
        },
      },
    });
  }
}
