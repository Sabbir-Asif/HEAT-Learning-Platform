import { describe, expect, test, vi } from "vitest";
import { AuditLogService } from "../../src/audit/audit-log.service";
import { ApiException } from "../../src/http/api-exception";

const query = { page: 1, pageSize: 25, actor: "a" };

const build = (matchCount: number) => {
  const database = {
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue(Array.from({ length: matchCount }, (_, index) => ({ id: `u${index}` }))),
    },
    auditLog: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
  };
  return { service: new AuditLogService(database as never), database };
};

describe("AuditLogService actor filter", () => {
  test("filters by every matching account when the match count is within the cap", async () => {
    const { service, database } = build(500);

    await service.list(query);

    expect(database.auditLog.findMany).toHaveBeenCalledOnce();
  });

  test("rejects with a stable code instead of truncating when too many accounts match", async () => {
    const { service, database } = build(501);

    const failure = await service.list(query).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiException);
    expect((failure as ApiException).code).toBe("AUDIT_ACTOR_FILTER_TOO_BROAD");
    expect((failure as ApiException).getStatus()).toBe(400);
    expect(database.auditLog.findMany).not.toHaveBeenCalled();
  });
});
