import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, test } from "vitest";
import { hashRefreshToken } from "../../src/auth/token-hash";
import { buildSessionHarness } from "../support/auth-fixtures";

const setup = (overrides: Record<string, string> = {}) => {
  const harness = buildSessionHarness(overrides);
  const student = harness.store.addUser();
  const admin = harness.store.addUser({ realm: "ADMIN", role: "ADMIN" });
  return { ...harness, student, admin };
};

describe("create", () => {
  test("stores only the hash of the refresh token", async () => {
    const { service, store, student } = setup();
    const tokens = await service.create(student.id, "student", { userAgent: "agent" });

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.refreshTokenHash).toBe(hashRefreshToken(tokens.refreshToken));
    expect(JSON.stringify(store.rows)).not.toContain(tokens.refreshToken);
    expect(tokens.familyId).toBe(store.rows[0]?.familyId);
  });

  test("sets the refresh expiry from the configured lifetime", async () => {
    const { service, clock, student } = setup({ REFRESH_TOKEN_TTL_DAYS: "2" });
    const tokens = await service.create(student.id, "student");

    expect(tokens.refreshExpiresAt.getTime() - clock.now().getTime()).toBe(2 * 86_400_000);
    expect(tokens.accessExpiresAt.getTime() - clock.now().getTime()).toBe(600_000);
  });

  test.each([
    ["an unknown user", () => ({ id: "5b0f0f6e-0000-4000-8000-000000000000" })],
    [
      "a deactivated user",
      (s: ReturnType<typeof setup>) => s.store.addUser({ deactivatedAt: new Date() }),
    ],
    ["a deleted user", (s: ReturnType<typeof setup>) => s.store.addUser({ deletedAt: new Date() })],
    ["a user of the other realm", (s: ReturnType<typeof setup>) => s.admin],
  ])("refuses %s", async (_name, pick) => {
    const context = setup();
    const user = pick(context);
    await expect(context.service.create(user.id, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe("refresh", () => {
  test("issues a new pair and marks the old token rotated", async () => {
    const { service, store, clock, student } = setup();
    const first = await service.create(student.id, "student");
    clock.advanceSeconds(60);

    const second = await service.refresh(first.refreshToken, "student");

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);
    expect(second.familyId).toBe(first.familyId);
    expect(store.rows).toHaveLength(2);
    expect(store.rows[0]?.rotatedAt).toEqual(clock.now());
    expect(store.rows[1]?.rotatedAt).toBeNull();
    expect(store.rows[1]?.refreshTokenHash).toBe(hashRefreshToken(second.refreshToken));
  });

  test("the new token can be refreshed again", async () => {
    const { service, clock, student } = setup();
    const first = await service.create(student.id, "student");
    const second = await service.refresh(first.refreshToken, "student");
    clock.advanceSeconds(30);

    const third = await service.refresh(second.refreshToken, "student");

    expect(third.familyId).toBe(first.familyId);
  });

  test("returns the same pair when the token is presented again 5 seconds later", async () => {
    const { service, clock, student, store } = setup();
    const first = await service.create(student.id, "student");
    const second = await service.refresh(first.refreshToken, "student");
    clock.advanceSeconds(5);

    const again = await service.refresh(first.refreshToken, "student");

    expect(again).toEqual(second);
    expect(store.rows.every((row) => row.revokedAt === null)).toBe(true);
    await expect(service.authenticate(again.accessToken, "student")).resolves.toMatchObject({
      userId: student.id,
    });
  });

  test("parallel refreshes with one token return one consistent pair", async () => {
    const { service, student, store } = setup();
    const first = await service.create(student.id, "student");

    const results = await Promise.all(
      Array.from({ length: 5 }, () => service.refresh(first.refreshToken, "student")),
    );

    expect(new Set(results.map((tokens) => tokens.refreshToken)).size).toBe(1);
    expect(store.rows).toHaveLength(2);
  });

  test("revokes the whole family and refuses when the token is reused after the grace window", async () => {
    const { service, clock, student, store } = setup();
    const first = await service.create(student.id, "student");
    const second = await service.refresh(first.refreshToken, "student");
    clock.advanceSeconds(21);

    await expect(service.refresh(first.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(store.rows.every((row) => row.revokedAt !== null)).toBe(true);
    await expect(service.refresh(second.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("honours a configured grace window", async () => {
    const { service, clock, student } = setup({ REFRESH_GRACE_SECONDS: "2" });
    const first = await service.create(student.id, "student");
    await service.refresh(first.refreshToken, "student");
    clock.advanceSeconds(3);

    await expect(service.refresh(first.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("refuses an unknown token", async () => {
    const { service } = setup();
    await expect(service.refresh("not-a-token", "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("refuses an expired token", async () => {
    const { service, clock, student } = setup({ REFRESH_TOKEN_TTL_DAYS: "1" });
    const first = await service.create(student.id, "student");
    clock.advanceMinutes(24 * 60 + 1);

    await expect(service.refresh(first.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("refuses a student token on the admin realm", async () => {
    const { service, student } = setup();
    const first = await service.create(student.id, "student");

    await expect(service.refresh(first.refreshToken, "admin")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("refuses a user deactivated since the last refresh", async () => {
    const { service, student } = setup();
    const first = await service.create(student.id, "student");
    student.deactivatedAt = new Date();

    await expect(service.refresh(first.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("releases the claim and rethrows when the database rotation fails", async () => {
    const { service, store, claims, student } = setup();
    const first = await service.create(student.id, "student");
    store.failNextRotation = new Error("database down");

    await expect(service.refresh(first.refreshToken, "student")).rejects.toThrow("database down");

    expect(claims.keys()).toEqual([]);
    await expect(service.refresh(first.refreshToken, "student")).resolves.toBeDefined();
  });

  test("releases the claim and refuses when the token was already rotated elsewhere", async () => {
    const { service, store, claims, student } = setup();
    const first = await service.create(student.id, "student");
    store.rotateResult = false;

    await expect(service.refresh(first.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(claims.keys()).toEqual([]);
  });

  test("refuses when a competing claim disappears before it can be read", async () => {
    const { service, claims, student } = setup();
    const first = await service.create(student.id, "student");
    const original = claims.claim.bind(claims);
    claims.claim = async (key, value, ttl) => {
      await original(key, value, ttl);
      await claims.release(key);
      return false;
    };

    await expect(service.refresh(first.refreshToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("keeps no raw refresh token in the claim store", async () => {
    const { service, claims, student } = setup();
    const first = await service.create(student.id, "student");
    const second = await service.refresh(first.refreshToken, "student");

    const sealed = await claims.read(claims.keys()[0] ?? "");
    expect(sealed).not.toContain(second.refreshToken);
    expect(claims.keys()[0]).toContain(hashRefreshToken(first.refreshToken));
    expect(claims.keys()[0]).not.toContain(first.refreshToken);
  });
});

describe("admin idle timeout", () => {
  test("refuses an admin session idle for more than 30 minutes and revokes it", async () => {
    const { service, clock, admin, store } = setup();
    const first = await service.create(admin.id, "admin");
    clock.advanceMinutes(31);

    await expect(service.refresh(first.refreshToken, "admin")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(store.rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  test("allows an admin refresh inside the idle window and measures from the last rotation", async () => {
    const { service, clock, admin } = setup();
    const first = await service.create(admin.id, "admin");
    clock.advanceMinutes(29);
    const second = await service.refresh(first.refreshToken, "admin");
    clock.advanceMinutes(29);

    await expect(service.refresh(second.refreshToken, "admin")).resolves.toBeDefined();
  });

  test("does not apply the idle limit to students", async () => {
    const { service, clock, student } = setup();
    const first = await service.create(student.id, "student");
    clock.advanceMinutes(120);

    await expect(service.refresh(first.refreshToken, "student")).resolves.toBeDefined();
  });
});

describe("authenticate", () => {
  test("accepts a live access token for its realm", async () => {
    const { service, student } = setup();
    const tokens = await service.create(student.id, "student");

    await expect(service.authenticate(tokens.accessToken, "student")).resolves.toEqual({
      userId: student.id,
      familyId: tokens.familyId,
      realm: "student",
      role: "STUDENT",
    });
  });

  test("rejects a student access token for the admin audience", async () => {
    const { service, student } = setup();
    const tokens = await service.create(student.id, "student");

    await expect(service.authenticate(tokens.accessToken, "admin")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("rejects after the session is revoked", async () => {
    const { service, student } = setup();
    const tokens = await service.create(student.id, "student");
    await service.revoke(tokens.familyId);

    await expect(service.authenticate(tokens.accessToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("rejects when the user is deactivated", async () => {
    const { service, student } = setup();
    const tokens = await service.create(student.id, "student");
    student.deactivatedAt = new Date();

    await expect(service.authenticate(tokens.accessToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("rejects when the user is gone", async () => {
    const { service, store, student } = setup();
    const tokens = await service.create(student.id, "student");
    store.users.delete(student.id);

    await expect(service.authenticate(tokens.accessToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("rejects when the session row is gone or expired", async () => {
    const { service, store, clock, student } = setup({ REFRESH_TOKEN_TTL_DAYS: "1" });
    const tokens = await service.create(student.id, "student");
    clock.advanceSeconds(1);
    const expired = await service.authenticate(tokens.accessToken, "student");
    expect(expired.userId).toBe(student.id);

    store.rows.length = 0;
    await expect(service.authenticate(tokens.accessToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("rejects a token whose session row has expired", async () => {
    const { service, store, student } = setup();
    const tokens = await service.create(student.id, "student");
    const row = store.rows[0];
    if (row) row.expiresAt = new Date(0);

    await expect(service.authenticate(tokens.accessToken, "student")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  test("uses the newest row of the family after a rotation", async () => {
    const { service, student } = setup();
    const first = await service.create(student.id, "student");
    const second = await service.refresh(first.refreshToken, "student");

    await expect(service.authenticate(second.accessToken, "student")).resolves.toMatchObject({
      familyId: first.familyId,
    });
  });
});

describe("revocation", () => {
  test("revoke ends every row of one family and leaves other families", async () => {
    const { service, store, student } = setup();
    const a = await service.create(student.id, "student");
    const b = await service.create(student.id, "student");
    await service.refresh(a.refreshToken, "student");

    await service.revoke(a.familyId);

    expect(store.rows.filter((row) => row.familyId === a.familyId).every((r) => r.revokedAt)).toBe(
      true,
    );
    await expect(service.refresh(b.refreshToken, "student")).resolves.toBeDefined();
  });

  test("revokeAll ends every session of the user only", async () => {
    const { service, student, admin } = setup();
    const a = await service.create(student.id, "student");
    const b = await service.create(student.id, "student");
    const other = await service.create(admin.id, "admin");

    await service.revokeAll(student.id);

    for (const tokens of [a, b]) {
      await expect(service.refresh(tokens.refreshToken, "student")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    await expect(service.refresh(other.refreshToken, "admin")).resolves.toBeDefined();
  });

  test("revokeAllExceptCurrent makes every other session fail its next refresh", async () => {
    const { service, student } = setup();
    const current = await service.create(student.id, "student");
    const others = await Promise.all([
      service.create(student.id, "student"),
      service.create(student.id, "student"),
    ]);

    await service.revokeAllExceptCurrent(student.id, current.familyId);

    for (const tokens of others) {
      await expect(service.refresh(tokens.refreshToken, "student")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
    await expect(service.refresh(current.refreshToken, "student")).resolves.toBeDefined();
  });
});
