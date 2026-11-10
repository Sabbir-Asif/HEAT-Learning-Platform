import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { AdminMeResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { PasswordService, SessionService } from "../auth";

@Injectable()
export class AdminAccountService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async describe(userId: string): Promise<AdminMeResponse> {
    const user = await this.database.user.findFirst({
      where: { id: userId, deletedAt: null, deactivatedAt: null },
      select: { id: true, email: true, role: true, mustChangePassword: true },
    });
    if (user === null) throw new UnauthorizedException();
    return { user };
  }

  async changePassword(
    userId: string,
    currentFamilyId: string,
    currentPassword: string,
    newPassword: string,
    actor: AuditActor,
  ): Promise<void> {
    const user = await this.database.user.findFirst({
      where: { id: userId, deletedAt: null, deactivatedAt: null },
      select: { passwordHash: true },
    });
    if (user === null) throw new UnauthorizedException();
    if (!(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new ApiException(400, "INVALID_CREDENTIALS");
    }
    const passwordHash = await this.passwords.hashChecked(newPassword);
    await this.database.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await this.audit.record(tx, actor, {
        action: "admin.password.change",
        entity: "User",
        entityId: userId,
        after: { passwordChanged: true, mustChangePassword: false },
      });
    });
    await this.sessions.revokeAllExceptCurrent(userId, currentFamilyId);
  }

  async recordSignOut(actor: AuditActor): Promise<void> {
    await this.audit.recordStandalone(actor, {
      action: "admin.sign-out",
      entity: "User",
      entityId: actor.actorId,
    });
  }
}
