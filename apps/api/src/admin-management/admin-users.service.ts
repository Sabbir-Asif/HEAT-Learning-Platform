import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  AdminListQuery,
  AdminListResponse,
  AdminSummary,
  InviteAdminRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { PasswordService, SessionService, generateOpaqueToken, hashOpaqueToken } from "../auth";
import { APP_CONFIG, CLOCK, DATABASE, SecretBox } from "../core";
import type { AppConfig, Clock } from "../core";
import { ApiException } from "../http/api-exception";
import { auditData } from "./admin-audit";
import type { AdminAuditContext } from "./admin-audit";
import { adminRowSelect, statusOf, toSummary } from "./admin-summary";

const adminRealmWhere = {
  realm: "ADMIN" as const,
  role: { in: ["ADMIN" as const, "SUPER_ADMIN" as const] },
  deletedAt: null,
};

const orderBy = (sort: AdminListQuery["sort"]) => {
  switch (sort) {
    case "email":
      return { email: "asc" as const };
    case "-email":
      return { email: "desc" as const };
    case "createdAt":
      return { createdAt: "asc" as const };
    default:
      return { createdAt: "desc" as const };
  }
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly secretBox: SecretBox,
  ) {}

  async list(query: AdminListQuery): Promise<AdminListResponse> {
    const [rows, total] = await Promise.all([
      this.database.user.findMany({
        where: adminRealmWhere,
        orderBy: [orderBy(query.sort), { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminRowSelect,
      }),
      this.database.user.count({ where: adminRealmWhere }),
    ]);
    const now = this.clock.now();
    return {
      items: rows.map((row) => toSummary(row, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async invite(request: InviteAdminRequest, context: AdminAuditContext): Promise<AdminSummary> {
    const existing = await this.database.user.findFirst({
      where: { email: { equals: request.email, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing !== null) throw new ApiException(409, "EMAIL_IN_USE");
    const passwordHash = await this.passwords.hash(randomBytes(32).toString("base64"));
    const token = generateOpaqueToken();
    const expiresAt = this.expiry();
    try {
      const id = await this.database.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: request.email, passwordHash, role: "ADMIN", realm: "ADMIN" },
          select: { id: true },
        });
        await this.queueInvitation(tx, user.id, token, expiresAt);
        await tx.auditLog.create({
          data: auditData(context, {
            action: "admin.invite",
            entityId: user.id,
            after: { status: "INVITED" },
          }),
        });
        return user.id;
      });
      return await this.describe(id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiException(409, "EMAIL_IN_USE");
      throw error;
    }
  }

  async resendInvitation(id: string, context: AdminAuditContext): Promise<AdminSummary> {
    const target = await this.manageable(id);
    if (statusOf(target, this.clock.now()) === "ACTIVE" || target.deactivatedAt !== null) {
      throw new ApiException(409, "INVITATION_NOT_PENDING");
    }
    const before = statusOf(target, this.clock.now());
    const token = generateOpaqueToken();
    const expiresAt = this.expiry();
    await this.database.$transaction(async (tx) => {
      await tx.authToken.deleteMany({ where: { userId: id, purpose: "INVITE", usedAt: null } });
      await this.queueInvitation(tx, id, token, expiresAt);
      await tx.auditLog.create({
        data: auditData(context, {
          action: "admin.invite.resend",
          entityId: id,
          before: { status: before },
          after: { status: "INVITED" },
        }),
      });
    });
    return this.describe(id);
  }

  async deactivate(id: string, context: AdminAuditContext): Promise<AdminSummary> {
    if (id === context.actorId) throw new ApiException(409, "CANNOT_DEACTIVATE_SELF");
    const target = await this.manageable(id);
    if (target.deactivatedAt === null) {
      const before = statusOf(target, this.clock.now());
      await this.database.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { deactivatedAt: this.clock.now() } });
        await tx.auditLog.create({
          data: auditData(context, {
            action: "admin.deactivate",
            entityId: id,
            before: { status: before },
            after: { status: "DEACTIVATED" },
          }),
        });
      });
    }
    try {
      await this.sessions.revokeAll(id);
    } catch (error) {
      this.logger.warn("Sessions could not be revoked after an administrator was deactivated");
      throw error;
    }
    return this.describe(id);
  }

  async reactivate(id: string, context: AdminAuditContext): Promise<AdminSummary> {
    const target = await this.manageable(id);
    if (target.deactivatedAt !== null) {
      await this.database.$transaction(async (tx) => {
        await tx.user.update({ where: { id }, data: { deactivatedAt: null } });
        await tx.auditLog.create({
          data: auditData(context, {
            action: "admin.reactivate",
            entityId: id,
            before: { status: "DEACTIVATED" },
            after: { status: "ACTIVE" },
          }),
        });
      });
    }
    return this.describe(id);
  }

  private expiry(): Date {
    return new Date(this.clock.now().getTime() + this.config.invitations.ttlHours * 3_600_000);
  }

  private async manageable(id: string) {
    const row = await this.database.user.findFirst({
      where: { id, ...adminRealmWhere },
      select: adminRowSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    if (row.role !== "ADMIN") throw new ApiException(403, "FORBIDDEN");
    return row;
  }

  private async describe(id: string): Promise<AdminSummary> {
    const row = await this.database.user.findFirst({
      where: { id, ...adminRealmWhere },
      select: adminRowSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return toSummary(row, this.clock.now());
  }

  private async queueInvitation(
    tx: Pick<HeatClient, "authToken" | "outbox">,
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await tx.authToken.create({
      data: { userId, purpose: "INVITE", tokenHash: hashOpaqueToken(token), expiresAt },
    });
    await tx.outbox.create({
      data: {
        eventType: "admin.invitation.issued",
        payload: {
          template: "admin-invitation",
          userId,
          expiresAt: expiresAt.toISOString(),
          encryptedToken: this.secretBox.encrypt(token),
        },
      },
    });
  }
}
