import { describe, expect, test } from "vitest";
import { statusOf, toSummary } from "../../src/admin-management/admin-summary";
import type { AdminRow } from "../../src/admin-management/admin-summary";

const now = new Date("2026-11-10T06:00:00.000Z");
const hour = 3_600_000;

const row = (overrides: Partial<AdminRow> = {}): AdminRow => ({
  id: "0198f1a0-0000-7000-8000-000000000001",
  email: "admin@example.test",
  role: "ADMIN",
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  deactivatedAt: null,
  authTokens: [],
  ...overrides,
});

describe("statusOf", () => {
  test("an admin without a pending invitation is active", () => {
    expect(statusOf(row(), now)).toBe("ACTIVE");
  });

  test("a pending invitation is invited until it expires, then expired", () => {
    expect(
      statusOf(row({ authTokens: [{ expiresAt: new Date(now.getTime() + hour) }] }), now),
    ).toBe("INVITED");
    expect(
      statusOf(row({ authTokens: [{ expiresAt: new Date(now.getTime() - hour) }] }), now),
    ).toBe("INVITE_EXPIRED");
    expect(statusOf(row({ authTokens: [{ expiresAt: now }] }), now)).toBe("INVITE_EXPIRED");
  });

  test("deactivation wins over a pending invitation and hides its expiry", () => {
    const deactivated = row({
      deactivatedAt: now,
      authTokens: [{ expiresAt: new Date(now.getTime() + hour) }],
    });

    expect(statusOf(deactivated, now)).toBe("DEACTIVATED");
    expect(toSummary(deactivated, now)).toMatchObject({
      status: "DEACTIVATED",
      inviteExpiresAt: null,
      deactivatedAt: now.toISOString(),
    });
  });
});
