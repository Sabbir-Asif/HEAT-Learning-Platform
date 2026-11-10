import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit/audit.service";
import { auditScopeStorage } from "../../src/audit/audit-scope";

const actor = { actorId: "actor", ipAddress: "203.0.113.4", requestId: "req" };

describe("AuditService", () => {
  test("record writes the actor, the entry and redacted changes", async () => {
    const create = vi.fn().mockResolvedValue({});
    const service = new AuditService({} as never);

    await service.record({ auditLog: { create } } as never, actor, {
      action: "admin.invite",
      entity: "User",
      entityId: "e1",
      before: { status: "A" },
      after: { status: "B", passwordHash: "secret" },
    });

    const data = create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({
      actorId: "actor",
      action: "admin.invite",
      entity: "User",
      entityId: "e1",
      before: { status: "A" },
      requestId: "req",
      ipAddress: "203.0.113.4",
    });
    expect(JSON.stringify(data.after)).not.toContain("secret");
  });

  test("record fills absent optional fields with null and omits empty changes", async () => {
    const create = vi.fn().mockResolvedValue({});

    await new AuditService({} as never).record(
      { auditLog: { create } } as never,
      { actorId: null },
      { action: "system.tick", entity: "Job" },
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: "system.tick",
        entity: "Job",
        entityId: null,
        requestId: null,
        ipAddress: null,
      },
    });
  });

  test("recordStandalone writes through the database client", async () => {
    const create = vi.fn().mockResolvedValue({});

    await new AuditService({ auditLog: { create } } as never).recordStandalone(actor, {
      action: "a",
      entity: "E",
    });

    expect(create).toHaveBeenCalledOnce();
  });

  test("client prefers the request transaction and falls back otherwise", () => {
    const service = new AuditService({} as never);
    const fallback = { name: "fallback" };
    const tx = { name: "tx" };

    expect(service.client(fallback as never)).toBe(fallback);
    auditScopeStorage.run({ tx: tx as never, changes: [] }, () => {
      expect(service.client(fallback as never)).toBe(tx);
    });
  });

  test("capture collects changes inside a request and refuses outside one", () => {
    const service = new AuditService({} as never);
    const scope = { tx: {} as never, changes: [] as { entityId: string }[] };

    auditScopeStorage.run(scope, () => service.capture({ entityId: "e1" }));

    expect(scope.changes).toEqual([{ entityId: "e1" }]);
    expect(() => service.capture({ entityId: "e1" })).toThrow(
      "capture was called outside an @Audited request",
    );
  });

  test("afterCommit queues a task inside a request and refuses outside one", () => {
    const service = new AuditService({} as never);
    const scope = { tx: {} as never, changes: [] };
    const task = async () => undefined;

    auditScopeStorage.run(scope, () => service.afterCommit(task));

    expect((scope as { afterCommit?: unknown[] }).afterCommit).toEqual([task]);
    expect(() => service.afterCommit(task)).toThrow(
      "afterCommit was called outside an @Audited request",
    );
  });

  test("skip marks the request scope so a handler that changed nothing writes no audit row", () => {
    const service = new AuditService({} as never);
    const scope: { tx: never; changes: never[]; skipped?: boolean } = {
      tx: {} as never,
      changes: [],
    };

    auditScopeStorage.run(scope, () => service.skip());

    expect(scope.skipped).toBe(true);
    expect(() => service.skip()).toThrow("skip was called outside an @Audited request");
  });
});
