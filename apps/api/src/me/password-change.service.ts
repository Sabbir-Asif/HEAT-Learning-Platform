import { Inject, Injectable } from "@nestjs/common";
import { passwordCodeLifetimeMinutes, passwordCodeMaxAttempts } from "@heat/contracts";
import type { ChangeStudentPasswordRequest, PasswordCodeRequestedResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { PasswordService, SessionService } from "../auth";
import { CLOCK, DATABASE, SecretBox } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { RateLimitStore, SignInLockout } from "../rate-limit";
import {
  PASSWORD_CHANGE_AUDIT_ACTION,
  PASSWORD_CODE_EVENT_TYPE,
  PASSWORD_CODE_PURPOSE,
  PASSWORD_CODE_REQUEST_LIMIT,
  PASSWORD_CODE_REQUEST_WINDOW_MS,
  PASSWORD_CODE_TEMPLATE,
  attemptsKey,
  generatePasswordCode,
  passwordCodeExpiry,
  passwordCodeMatches,
  remainingSeconds,
  sealPasswordCode,
} from "./password-code";

const accountSelect = {
  email: true,
  passwordHash: true,
  emailVerifiedAt: true,
} as const;

@Injectable()
export class PasswordChangeService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly lockout: SignInLockout,
    private readonly attempts: RateLimitStore,
    private readonly secretBox: SecretBox,
    private readonly audit: AuditService,
  ) {}

  async requestCode(userId: string): Promise<PasswordCodeRequestedResponse> {
    await this.loadVerified(userId);
    const now = this.clock.now();
    const recent = await this.database.authToken.count({
      where: {
        userId,
        purpose: PASSWORD_CODE_PURPOSE,
        createdAt: { gt: new Date(now.getTime() - PASSWORD_CODE_REQUEST_WINDOW_MS) },
      },
    });
    if (recent >= PASSWORD_CODE_REQUEST_LIMIT) {
      throw new ApiException(429, "RATE_LIMITED", PASSWORD_CODE_REQUEST_WINDOW_MS / 1000);
    }
    const code = generatePasswordCode();
    await this.database.$transaction(async (tx) => {
      await tx.authToken.updateMany({
        where: { userId, purpose: PASSWORD_CODE_PURPOSE, usedAt: null },
        data: { usedAt: now },
      });
      await tx.authToken.create({
        data: {
          userId,
          purpose: PASSWORD_CODE_PURPOSE,
          tokenHash: sealPasswordCode(code),
          expiresAt: passwordCodeExpiry(now),
        },
      });
      await tx.outbox.create({
        data: {
          eventType: PASSWORD_CODE_EVENT_TYPE,
          payload: {
            template: PASSWORD_CODE_TEMPLATE,
            userId,
            encryptedCode: this.secretBox.encrypt(code),
            expiresInMinutes: passwordCodeLifetimeMinutes,
          },
        },
      });
    });
    return { expiresInMinutes: passwordCodeLifetimeMinutes };
  }

  async change(
    userId: string,
    currentFamilyId: string,
    request: ChangeStudentPasswordRequest,
    actor: AuditActor,
  ): Promise<void> {
    const user = await this.loadVerified(userId);
    await this.lockout.reserve("student", user.email, actor.ipAddress);
    if (!(await this.passwords.verify(user.passwordHash, request.currentPassword))) {
      throw new ApiException(400, "INVALID_CREDENTIALS");
    }
    const token = await this.activeCode(userId);
    await this.assertCode(token, request.code);
    const passwordHash = await this.passwords.hashChecked(request.newPassword);
    await this.sessions.revokeAllExceptCurrent(userId, currentFamilyId);
    await this.database.$transaction(async (tx) => {
      const now = this.clock.now();
      const claimed = await tx.authToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new ApiException(410, "PASSWORD_CODE_EXPIRED");
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await this.audit.record(tx, actor, {
        action: PASSWORD_CHANGE_AUDIT_ACTION,
        entity: "User",
        entityId: userId,
        after: { passwordChanged: true },
      });
    });
    await this.lockout.recordSuccess("student", user.email, actor.ipAddress);
  }

  private async loadVerified(userId: string) {
    const user = await this.database.user.findFirst({
      where: { id: userId, realm: "STUDENT", deletedAt: null, deactivatedAt: null },
      select: accountSelect,
    });
    if (user === null) throw new ApiException(401, "UNAUTHENTICATED");
    if (user.emailVerifiedAt === null)
      throw new ApiException(403, "PASSWORD_CODE_EMAIL_UNVERIFIED");
    return user;
  }

  private async activeCode(userId: string) {
    const token = await this.database.authToken.findFirst({
      where: {
        userId,
        purpose: PASSWORD_CODE_PURPOSE,
        usedAt: null,
        expiresAt: { gt: this.clock.now() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, tokenHash: true, expiresAt: true },
    });
    if (token === null) throw new ApiException(410, "PASSWORD_CODE_EXPIRED");
    return token;
  }

  private async assertCode(
    token: { id: string; tokenHash: string; expiresAt: Date },
    candidate: string,
  ): Promise<void> {
    const now = this.clock.now();
    const { count } = await this.attempts.hit(
      attemptsKey(token.id),
      remainingSeconds(token.expiresAt, now),
    );
    if (count > passwordCodeMaxAttempts) {
      await this.invalidate(token.id);
      throw new ApiException(410, "PASSWORD_CODE_EXPIRED");
    }
    if (passwordCodeMatches(token.tokenHash, candidate)) return;
    if (count >= passwordCodeMaxAttempts) await this.invalidate(token.id);
    throw new ApiException(400, "PASSWORD_CODE_INVALID");
  }

  private async invalidate(tokenId: string): Promise<void> {
    await this.database.authToken.updateMany({
      where: { id: tokenId, usedAt: null },
      data: { usedAt: this.clock.now() },
    });
  }
}
