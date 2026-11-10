import { AsyncLocalStorage } from "node:async_hooks";
import type { HeatClient } from "@heat/db";
import type { AuditChange } from "./audit.types";

export type AuditTransaction = Parameters<Parameters<HeatClient["$transaction"]>[0]>[0];

export type AfterCommitTask = () => Promise<void>;

export interface AuditScope {
  tx: AuditTransaction;
  changes: AuditChange[];
  afterCommit?: AfterCommitTask[];
}

export const auditScopeStorage = new AsyncLocalStorage<AuditScope>();
