export interface AdminAuditContext {
  actorId: string;
  ipAddress?: string;
  requestId?: string;
}

export interface AdminAuditEntry {
  action: string;
  entityId: string;
  before?: { status: string };
  after?: { status: string };
}

export const auditData = (context: AdminAuditContext, entry: AdminAuditEntry) => ({
  actorId: context.actorId,
  action: entry.action,
  entity: "User",
  entityId: entry.entityId,
  before: entry.before ?? undefined,
  after: entry.after ?? undefined,
  requestId: context.requestId ?? null,
  ipAddress: context.ipAddress ?? null,
});
