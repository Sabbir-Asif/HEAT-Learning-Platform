import { describe, expect, test } from "vitest";
import { auditLogListQuerySchema } from "../src/index";

describe("auditLogListQuerySchema", () => {
  test("defaults the page and page size and accepts no filters", () => {
    expect(auditLogListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
  });

  test("accepts actor, action, entity and a date range and trims them", () => {
    expect(
      auditLogListQuerySchema.parse({
        actor: " root@example.test ",
        action: "admin.",
        entity: "User",
        from: "2026-11-01",
        to: "2026-11-10",
      }),
    ).toMatchObject({
      actor: "root@example.test",
      action: "admin.",
      entity: "User",
      from: "2026-11-01",
      to: "2026-11-10",
    });
  });

  test("rejects a malformed date and a range that ends before it starts", () => {
    expect(auditLogListQuerySchema.safeParse({ from: "01/11/2026" }).success).toBe(false);
    expect(auditLogListQuerySchema.safeParse({ from: "2026-02-31" }).success).toBe(false);
    expect(
      auditLogListQuerySchema.safeParse({ from: "2026-11-10", to: "2026-11-01" }).success,
    ).toBe(false);
  });

  test("rejects a page size outside the allowed list", () => {
    expect(auditLogListQuerySchema.safeParse({ pageSize: 7 }).success).toBe(false);
  });
});
