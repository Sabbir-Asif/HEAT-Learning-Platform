import { findUserIdsByEmail } from "@heat/db";
import { Inject, Injectable } from "@nestjs/common";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { CLOCK } from "../core";
import type { Clock } from "../core";
import {
  ALREADY_REGISTERED_EVENT_TYPE,
  ALREADY_REGISTERED_TEMPLATE_KEY,
  REGISTRATION_DUPLICATE_AUDIT_ACTION,
  REGISTRATION_LOCK_TIMEOUT_MS,
  REGISTRATION_REPLACED_AUDIT_ACTION,
} from "./account-protection.constants";
import type {
  AlreadyRegisteredPayload,
  RegistrationOutcome,
  RegistrationPolicyTransaction,
} from "./registration-policy.types";

@Injectable()
export class RegistrationPolicyService {
  constructor(
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async apply(
    tx: RegistrationPolicyTransaction,
    email: string,
    actor: AuditActor,
  ): Promise<RegistrationOutcome> {
    await tx.$executeRaw`SELECT set_config('lock_timeout', ${`${REGISTRATION_LOCK_TIMEOUT_MS}ms`}, true)`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(lower(${email})))`;
    const existing = await tx.user.findFirst({
      where: { id: { in: await findUserIdsByEmail(tx, email) }, deletedAt: null },
      select: { id: true, realm: true, emailVerifiedAt: true },
    });
    if (existing === null) return { kind: "PROCEED", replacedUserId: null };
    if (existing.realm !== "STUDENT" || existing.emailVerifiedAt !== null) {
      return this.alreadyRegistered(tx, existing.id, actor);
    }
    await this.replace(tx, existing.id, actor);
    return { kind: "PROCEED", replacedUserId: existing.id };
  }

  private async alreadyRegistered(
    tx: RegistrationPolicyTransaction,
    userId: string,
    actor: AuditActor,
  ): Promise<RegistrationOutcome> {
    const payload: AlreadyRegisteredPayload = { template: ALREADY_REGISTERED_TEMPLATE_KEY, userId };
    await tx.outbox.create({ data: { eventType: ALREADY_REGISTERED_EVENT_TYPE, payload } });
    await this.audit.record(tx, actor, {
      action: REGISTRATION_DUPLICATE_AUDIT_ACTION,
      entity: "User",
      entityId: userId,
    });
    return { kind: "ALREADY_REGISTERED", userId };
  }

  private async replace(
    tx: RegistrationPolicyTransaction,
    userId: string,
    actor: AuditActor,
  ): Promise<void> {
    const now = this.clock.now();
    await tx.user.update({ where: { id: userId }, data: { deletedAt: now } });
    await tx.studentProfile.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.enrollment.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    });
    await tx.authToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await this.audit.record(tx, actor, {
      action: REGISTRATION_REPLACED_AUDIT_ACTION,
      entity: "User",
      entityId: userId,
      before: { status: "UNVERIFIED" },
      after: { status: "REPLACED" },
    });
  }
}
