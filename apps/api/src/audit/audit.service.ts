import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { redact } from "./audit-redaction";
import { auditScopeStorage } from "./audit-scope";
import type { AfterCommitTask, AuditTransaction } from "./audit-scope";
import type { AuditActor, AuditChange, AuditEntry, AuditWriter } from "./audit.types";

const present = (value: unknown) => (value === undefined ? undefined : redact(value));

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {}

  async record(writer: AuditWriter, actor: AuditActor, entry: AuditEntry): Promise<void> {
    const before = present(entry.before);
    const after = present(entry.after);
    await writer.auditLog.create({
      data: {
        actorId: actor.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        ...(before === undefined || before === null ? {} : { before }),
        ...(after === undefined || after === null ? {} : { after }),
        requestId: actor.requestId ?? null,
        ipAddress: actor.ipAddress ?? null,
      },
    });
  }

  async recordStandalone(actor: AuditActor, entry: AuditEntry): Promise<void> {
    await this.record(this.database, actor, entry);
  }

  client(fallback: HeatClient): HeatClient | AuditTransaction {
    return auditScopeStorage.getStore()?.tx ?? fallback;
  }

  capture(change: AuditChange): void {
    const scope = auditScopeStorage.getStore();
    if (scope === undefined) {
      throw new Error("capture was called outside an @Audited request");
    }
    scope.changes.push(change);
  }

  afterCommit(task: AfterCommitTask): void {
    const scope = auditScopeStorage.getStore();
    if (scope === undefined) {
      throw new Error("afterCommit was called outside an @Audited request");
    }
    (scope.afterCommit ??= []).push(task);
  }
}
