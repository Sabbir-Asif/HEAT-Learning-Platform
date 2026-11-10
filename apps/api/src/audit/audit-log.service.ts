import { Inject, Injectable } from "@nestjs/common";
import type { AuditLogListQuery, AuditLogListResponse } from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import { DATABASE } from "../core";

const dhakaOffset = "+06:00";
const dayMs = 86_400_000;

const startOfDay = (date: string): Date => new Date(`${date}T00:00:00.000${dhakaOffset}`);

const startOfNextDay = (date: string): Date => new Date(startOfDay(date).getTime() + dayMs);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

@Injectable()
export class AuditLogService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async list(query: AuditLogListQuery): Promise<AuditLogListResponse> {
    const where = await this.where(query);
    const [rows, total] = await Promise.all([
      this.database.auditLog.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.auditLog.count({ where }),
    ]);
    const actorIds = [
      ...new Set(rows.flatMap((row) => (row.actorId === null ? [] : [row.actorId]))),
    ];
    const actors =
      actorIds.length === 0
        ? []
        : await this.database.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, email: true },
          });
    const emails = new Map(actors.map((actor) => [actor.id, actor.email]));
    return {
      items: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        actorId: row.actorId,
        actorEmail: row.actorId === null ? null : (emails.get(row.actorId) ?? null),
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        before: asRecord(row.before),
        after: asRecord(row.after),
        requestId: row.requestId,
        ipAddress: row.ipAddress,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async where(query: AuditLogListQuery): Promise<Prisma.AuditLogWhereInput> {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.actor !== undefined) {
      const matches = await this.database.user.findMany({
        where: { email: { contains: query.actor, mode: "insensitive" } },
        select: { id: true },
        take: 500,
      });
      where.actorId = { in: matches.map((match) => match.id) };
    }
    if (query.action !== undefined) {
      where.action = { contains: query.action, mode: "insensitive" };
    }
    if (query.entity !== undefined) where.entity = { equals: query.entity, mode: "insensitive" };
    if (query.from !== undefined || query.to !== undefined) {
      where.occurredAt = {
        ...(query.from === undefined ? {} : { gte: startOfDay(query.from) }),
        ...(query.to === undefined ? {} : { lt: startOfNextDay(query.to) }),
      };
    }
    return where;
  }
}
