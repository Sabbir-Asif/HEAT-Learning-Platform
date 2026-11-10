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

describe("AuditLogService.list mapping and filters", () => {
  const occurredAt = new Date("2026-11-10T06:00:00.000Z");
  const rows = [
    {
      id: "1",
      occurredAt,
      actorId: "u1",
      action: "admin.invite",
      entity: "User",
      entityId: "e1",
      before: null,
      after: { status: "INVITED" },
      requestId: "req",
      ipAddress: "203.0.113.4",
    },
    {
      id: "2",
      occurredAt,
      actorId: null,
      action: "system.job",
      entity: "Job",
      entityId: null,
      before: ["not", "a", "record"],
      after: null,
      requestId: null,
      ipAddress: null,
    },
  ];

  const buildWithRows = () => {
    const database = {
      user: { findMany: vi.fn().mockResolvedValue([{ id: "u1", email: "boss@example.test" }]) },
      auditLog: {
        findMany: vi.fn().mockResolvedValue(rows),
        count: vi.fn().mockResolvedValue(2),
      },
    };
    return { service: new AuditLogService(database as never), database };
  };

  test("maps rows, resolves actor emails and keeps only object payloads", async () => {
    const { service } = buildWithRows();

    const result = await service.list({ page: 1, pageSize: 25 });

    expect(result.total).toBe(2);
    expect(result.items[0]).toMatchObject({
      actorEmail: "boss@example.test",
      occurredAt: occurredAt.toISOString(),
      before: null,
      after: { status: "INVITED" },
    });
    expect(result.items[1]).toMatchObject({ actorId: null, actorEmail: null, before: null });
  });

  test("does not look up actors when no row has one", async () => {
    const { service, database } = buildWithRows();
    database.auditLog.findMany.mockResolvedValue([rows[1]]);

    await service.list({ page: 1, pageSize: 25 });

    expect(database.user.findMany).not.toHaveBeenCalled();
  });

  test("filters by action, entity and Dhaka calendar days", async () => {
    const { service, database } = buildWithRows();

    await service.list({
      page: 2,
      pageSize: 10,
      action: "invite",
      entity: "user",
      from: "2026-11-01",
      to: "2026-11-02",
    });

    const call = database.auditLog.findMany.mock.calls[0]?.[0];
    expect(call.where).toEqual({
      action: { contains: "invite", mode: "insensitive" },
      entity: { equals: "user", mode: "insensitive" },
      occurredAt: {
        gte: new Date("2026-10-31T18:00:00.000Z"),
        lt: new Date("2026-11-02T18:00:00.000Z"),
      },
    });
    expect(call.skip).toBe(10);
    expect(call.take).toBe(10);
  });

  test("accepts an open-ended date range", async () => {
    const { service, database } = buildWithRows();

    await service.list({ page: 1, pageSize: 25, from: "2026-11-01" });
    await service.list({ page: 1, pageSize: 25, to: "2026-11-01" });

    expect(database.auditLog.findMany.mock.calls[0]?.[0].where.occurredAt).toEqual({
      gte: new Date("2026-10-31T18:00:00.000Z"),
    });
    expect(database.auditLog.findMany.mock.calls[1]?.[0].where.occurredAt).toEqual({
      lt: new Date("2026-11-01T18:00:00.000Z"),
    });
  });
});
