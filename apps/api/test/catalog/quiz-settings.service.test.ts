import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { QuizSettingsService } from "../../src/catalog/quiz-settings.service";

const settingId = "0198f1a0-0000-7000-8000-0000000000e3";
const at = new Date("2026-11-19T06:00:00.000Z");

const build = (stored?: unknown) => {
  const database = {
    siteSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue(stored === undefined ? null : { value: stored, updatedAt: at }),
      upsert: vi.fn().mockResolvedValue({ id: settingId, updatedAt: at }),
    },
  };
  const service = new QuizSettingsService(database as never, new AuditService({} as never));
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, inAuditScope };
};

describe("QuizSettingsService", () => {
  test("is unlimited before anything is saved", async () => {
    const { service } = build();
    expect(await service.admin()).toEqual({ attemptLimit: null, updatedAt: null });
  });

  test("returns the stored limit", async () => {
    const { service } = build({ attemptLimit: 5 });
    expect(await service.admin()).toEqual({ attemptLimit: 5, updatedAt: at.toISOString() });
  });

  test("falls back to unlimited when the stored value is malformed", async () => {
    const { service } = build({ attemptLimit: "x" });
    expect((await service.admin()).attemptLimit).toBeNull();
  });

  test("stores the limit and audits before and after", async () => {
    const { service, database, changes, inAuditScope } = build({ attemptLimit: 3 });
    const result = await inAuditScope(() => service.update({ attemptLimit: null }));
    expect(database.siteSetting.upsert).toHaveBeenCalledOnce();
    expect(result).toEqual({ attemptLimit: null, updatedAt: at.toISOString() });
    expect(changes[0]?.before).toEqual({ attemptLimit: 3 });
    expect(changes[0]?.after).toEqual({ attemptLimit: null });
  });
});
