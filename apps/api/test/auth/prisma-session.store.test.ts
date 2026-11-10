import type { HeatClient } from "@heat/db";
import { describe, expect, test, vi } from "vitest";
import { PrismaSessionStore } from "../../src/auth/prisma-session.store";
import type { NewSession } from "../../src/auth/session.store";

const at = new Date("2026-11-09T04:00:00.000Z");
const next: NewSession = {
  userId: "u",
  familyId: "f",
  refreshTokenHash: "h",
  createdAt: at,
  expiresAt: at,
};

const build = (updateCount = 1) => {
  const session = {
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
  };
  const user = { findUnique: vi.fn().mockResolvedValue(null) };
  const database = {
    session,
    user,
    $transaction: (work: (tx: unknown) => Promise<boolean>) => work({ session }),
  };
  return { session, user, store: new PrismaSessionStore(database as unknown as HeatClient) };
};

describe("PrismaSessionStore", () => {
  test("looks sessions up by hash and the newest row of a family", async () => {
    const { session, store } = build();
    await store.findByHash("h");
    await store.findLatest("f");

    expect(session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { refreshTokenHash: "h" } }),
    );
    expect(session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "f" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  test("reads the family start from its oldest row", async () => {
    const { session, store } = build();
    session.findFirst.mockResolvedValueOnce({ createdAt: new Date("2026-01-01T00:00:00.000Z") });

    await expect(store.findFamilyStart("f")).resolves.toEqual(new Date("2026-01-01T00:00:00.000Z"));
    await expect(store.findFamilyStart("g")).resolves.toBeNull();
    expect(session.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "f" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  test("loads the user with the fields that gate a session", async () => {
    const { user, store } = build();
    await store.findUser("u");

    expect(user.findUnique).toHaveBeenCalledWith({
      where: { id: "u" },
      select: {
        id: true,
        realm: true,
        role: true,
        deactivatedAt: true,
        deletedAt: true,
        mustChangePassword: true,
      },
    });
  });

  test("inserts a session without a user agent as nulls", async () => {
    const { session, store } = build();
    await store.insert(next);

    expect(session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userAgent: null, ipAddress: null, refreshTokenHash: "h" }),
    });
  });

  test("rotates inside a transaction, only when the old row is still current", async () => {
    const { session, store } = build();

    await expect(store.rotate("old", at, next)).resolves.toBe(true);

    expect(session.updateMany).toHaveBeenCalledWith({
      where: { id: "old", rotatedAt: null, revokedAt: null },
      data: { rotatedAt: at },
    });
    expect(session.create).toHaveBeenCalledTimes(1);
  });

  test("does not insert when the old row was already rotated", async () => {
    const { session, store } = build(0);

    await expect(store.rotate("old", at, next)).resolves.toBe(false);
    expect(session.create).not.toHaveBeenCalled();
  });

  test("revokes by family, by user and by user except one family", async () => {
    const { session, store } = build();
    await store.revokeFamily("f", at);
    await store.revokeUser("u", at);
    await store.revokeUserExcept("u", "f", at);

    expect(session.updateMany.mock.calls.map(([args]) => args)).toEqual([
      { where: { familyId: "f", revokedAt: null }, data: { revokedAt: at } },
      { where: { userId: "u", revokedAt: null }, data: { revokedAt: at } },
      {
        where: { userId: "u", familyId: { not: "f" }, revokedAt: null },
        data: { revokedAt: at },
      },
    ]);
  });
});
