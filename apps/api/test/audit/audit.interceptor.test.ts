import { Reflector } from "@nestjs/core";
import { firstValueFrom, of } from "rxjs";
import { describe, expect, test, vi } from "vitest";
import { AuditInterceptor } from "../../src/audit/audit.interceptor";
import type { AuditedMetadata } from "../../src/audit/audit.types";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AppConfig } from "../../src/core";

const metadata: AuditedMetadata = { action: "admin.deactivate", entity: "User" };
const config = { audit: { transactionMaxWaitMs: 1000, transactionTimeoutMs: 5000 } } as AppConfig;
const tx = { name: "tx" };

const handler = () => undefined;

const build = (declared: AuditedMetadata | undefined) => {
  const database = {
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) => run(tx)),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const reflector = { get: vi.fn().mockReturnValue(declared) };
  const interceptor = new AuditInterceptor(
    database as never,
    reflector as unknown as Reflector,
    audit as never,
    config,
  );
  const context = {
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        ip: "203.0.113.4",
        params: { id: "target" },
        authSession: { userId: "actor" },
      }),
    }),
  };
  return { interceptor, database, audit, context: context as never };
};

describe("AuditInterceptor", () => {
  test("passes undeclared handlers straight through", async () => {
    const { interceptor, database, context } = build(undefined);

    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of("plain") }),
    );

    expect(result).toBe("plain");
    expect(database.$transaction).not.toHaveBeenCalled();
  });

  test("records the entry against the route id in the same transaction as the handler", async () => {
    const { interceptor, database, audit, context } = build(metadata);

    const result = await firstValueFrom(
      interceptor.intercept(context, { handle: () => of("done") }),
    );

    expect(result).toBe("done");
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 1000,
      timeout: 5000,
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      { actorId: "actor", ipAddress: "203.0.113.4", requestId: undefined },
      { ...metadata, entityId: "target" },
    );
  });

  test("records every change the handler captured", async () => {
    const { interceptor, audit, context } = build(metadata);
    const handle = () => {
      auditScopeStorage.getStore()?.changes.push({ entityId: "a" }, { entityId: "b" });
      return of("done");
    };

    await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(audit.record.mock.calls.map((call) => call[2].entityId)).toEqual(["a", "b"]);
  });

  test("runs post-commit tasks after the transaction resolves and not when it fails", async () => {
    const { interceptor, database, context } = build(metadata);
    const order: string[] = [];
    database.$transaction.mockImplementation(
      async (run: (client: typeof tx) => Promise<unknown>) => {
        const result = await run(tx);
        order.push("committed");
        return result;
      },
    );
    const handle = () => {
      auditScopeStorage.getStore()?.afterCommit?.push(async () => {
        order.push("task");
      });
      return of("done");
    };

    await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(order).toEqual(["committed", "task"]);

    order.length = 0;
    database.$transaction.mockRejectedValueOnce(new Error("rolled back"));
    await expect(firstValueFrom(interceptor.intercept(context, { handle }))).rejects.toThrow(
      "rolled back",
    );
    expect(order).toEqual([]);
  });

  test("a failing post-commit task does not fail the request or skip later tasks", async () => {
    const { interceptor, context } = build(metadata);
    const ran: string[] = [];
    const handle = () => {
      const tasks = auditScopeStorage.getStore()?.afterCommit;
      tasks?.push(async () => {
        throw new Error("redis down");
      });
      tasks?.push(async () => {
        ran.push("second");
      });
      return of("done");
    };

    const result = await firstValueFrom(interceptor.intercept(context, { handle }));

    expect(result).toBe("done");
    expect(ran).toEqual(["second"]);
  });

  test("refuses a handler that emits more than one value", async () => {
    const { interceptor, audit, context } = build(metadata);

    await expect(
      firstValueFrom(interceptor.intercept(context, { handle: () => of(1, 2) })),
    ).rejects.toThrow("@Audited handlers must emit exactly one value");
    expect(audit.record).not.toHaveBeenCalled();
  });

  test("refuses server-sent event handlers", () => {
    const { interceptor, context } = build(metadata);
    Reflect.defineMetadata("__sse__", true, handler);

    expect(() => interceptor.intercept(context, { handle: () => of(1) })).toThrow(
      "@Audited handlers cannot be server-sent event streams",
    );
    Reflect.deleteMetadata("__sse__", handler);
  });
});
