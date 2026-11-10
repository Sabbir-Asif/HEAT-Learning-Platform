import { Inject, Injectable } from "@nestjs/common";
import type { AcceptInviteRequest, InvitationLookupResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { PasswordService, hashOpaqueToken } from "../auth";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { auditData } from "./admin-audit";

@Injectable()
export class AdminInvitationService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly passwords: PasswordService,
  ) {}

  async lookup(token: string): Promise<InvitationLookupResponse> {
    const invitation = await this.find(token);
    if (invitation === null) return { status: "INVALID" };
    if (invitation.expiresAt <= this.clock.now()) return { status: "EXPIRED" };
    return { status: "VALID", email: invitation.user.email };
  }

  async accept(
    request: AcceptInviteRequest,
    metadata: { ipAddress?: string; requestId?: string },
  ): Promise<void> {
    const invitation = await this.find(request.token);
    if (invitation === null) throw new ApiException(400, "INVITATION_INVALID");
    if (invitation.expiresAt <= this.clock.now()) throw new ApiException(400, "INVITATION_EXPIRED");
    const passwordHash = await this.passwords.hashChecked(request.password);
    const now = this.clock.now();
    await this.database.$transaction(async (tx) => {
      const consumed = await tx.authToken.updateMany({
        where: { id: invitation.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) throw new ApiException(400, "INVITATION_INVALID");
      await tx.user.update({
        where: { id: invitation.userId },
        data: { passwordHash, emailVerifiedAt: now, mustChangePassword: false },
      });
      await tx.auditLog.create({
        data: auditData(
          { actorId: invitation.userId, ...metadata },
          {
            action: "admin.invite.accept",
            entityId: invitation.userId,
            before: { status: "INVITED" },
            after: { status: "ACTIVE" },
          },
        ),
      });
    });
  }

  private async find(token: string) {
    const invitation = await this.database.authToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      select: {
        id: true,
        userId: true,
        purpose: true,
        usedAt: true,
        expiresAt: true,
        user: { select: { email: true, realm: true, deletedAt: true, deactivatedAt: true } },
      },
    });
    if (
      invitation === null ||
      invitation.purpose !== "INVITE" ||
      invitation.usedAt !== null ||
      invitation.user.realm !== "ADMIN" ||
      invitation.user.deletedAt !== null ||
      invitation.user.deactivatedAt !== null
    ) {
      return null;
    }
    return invitation;
  }
}
