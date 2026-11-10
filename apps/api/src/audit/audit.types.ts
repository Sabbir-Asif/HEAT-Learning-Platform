import type { HeatClient } from "@heat/db";

export type AuditWriter = Pick<HeatClient, "auditLog">;

export interface AuditActor {
  actorId: string | null;
  ipAddress?: string;
  requestId?: string;
}

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export interface AuditChange {
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

export interface AuditedMetadata {
  action: string;
  entity: string;
}
