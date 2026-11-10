import { Redis } from "ioredis";
import { afterEach, describe, expect, test } from "vitest";
import { SessionService } from "../../src/auth";
import { hashRefreshToken } from "../../src/auth/token-hash";
import { useTestApp } from "../support/testing-module";

describe("session service on real Postgres and Redis", () => {
  const testApp = useTestApp();
  const openRedis: Redis[] = [];

  afterEach(() => {
    for (const client of openRedis.splice(0)) client.disconnect();
  });

  const sessions = () => testApp().moduleRef.get(SessionService);
  const redis = () => {
    const client = new Redis(testApp().redisUrl);
    openRedis.push(client);
    return client;
  };
  const student = async () => (await testApp().factories.user()).id;

  test("parallel refresh with the same token returns one consistent pair", async () => {
    const first = await sessions().create(await student(), "student");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => sessions().refresh(first.refreshToken, "student")),
    );

    expect(new Set(results.map((tokens) => tokens.refreshToken)).size).toBe(1);
    expect(new Set(results.map((tokens) => tokens.accessToken)).size).toBe(1);
    const rows = await testApp().database.prisma.session.findMany({
      where: { familyId: first.familyId },
    });
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.rotatedAt !== null)).toHaveLength(1);
    expect(rows.every((row) => row.revokedAt === null)).toBe(true);
    await expect(
      sessions().authenticate(results[0]?.accessToken ?? "", "student"),
    ).resolves.toMatchObject({ familyId: first.familyId });
  });

  test("the rotation claim expires after the grace window", async () => {
    const first = await sessions().create(await student(), "student");
    await sessions().refresh(first.refreshToken, "student");

    const ttl = await redis().ttl(`auth:rotation:${hashRefreshToken(first.refreshToken)}`);

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(20);
  });

  test("reuse after the grace window revokes the family and gives 401", async () => {
    const first = await sessions().create(await student(), "student");
    const second = await sessions().refresh(first.refreshToken, "student");
    await redis().del(`auth:rotation:${hashRefreshToken(first.refreshToken)}`);
    await testApp().database.prisma.session.updateMany({
      where: { familyId: first.familyId, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - 21_000) },
    });

    await expect(sessions().refresh(first.refreshToken, "student")).rejects.toMatchObject({
      status: 401,
    });

    const rows = await testApp().database.prisma.session.findMany({
      where: { familyId: first.familyId },
    });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    await expect(sessions().refresh(second.refreshToken, "student")).rejects.toMatchObject({
      status: 401,
    });
    await expect(sessions().authenticate(second.accessToken, "student")).rejects.toMatchObject({
      status: 401,
    });
  });

  test("losing the claim inside the grace window refuses without revoking the family", async () => {
    const first = await sessions().create(await student(), "student");
    const second = await sessions().refresh(first.refreshToken, "student");
    await redis().del(`auth:rotation:${hashRefreshToken(first.refreshToken)}`);

    await expect(sessions().refresh(first.refreshToken, "student")).rejects.toMatchObject({
      status: 401,
    });

    const rows = await testApp().database.prisma.session.findMany({
      where: { familyId: first.familyId },
    });
    expect(rows.every((row) => row.revokedAt === null)).toBe(true);
    await expect(sessions().refresh(second.refreshToken, "student")).resolves.toBeDefined();
  });

  test("no raw refresh token is stored in the database", async () => {
    const first = await sessions().create(await student(), "student");
    const second = await sessions().refresh(first.refreshToken, "student");

    const rows = await testApp().database.prisma.session.findMany();
    const dump = JSON.stringify(rows);

    expect(dump).not.toContain(first.refreshToken);
    expect(dump).not.toContain(second.refreshToken);
    expect(rows.map((row) => row.refreshTokenHash).sort()).toEqual(
      [hashRefreshToken(first.refreshToken), hashRefreshToken(second.refreshToken)].sort(),
    );
  });

  test("revokeAllExceptCurrent makes every other session fail its next refresh", async () => {
    const userId = await student();
    const current = await sessions().create(userId, "student");
    const other = await sessions().create(userId, "student");
    const third = await sessions().create(userId, "student");

    await sessions().revokeAllExceptCurrent(userId, current.familyId);

    await expect(sessions().refresh(other.refreshToken, "student")).rejects.toMatchObject({
      status: 401,
    });
    await expect(sessions().refresh(third.refreshToken, "student")).rejects.toMatchObject({
      status: 401,
    });
    await expect(sessions().refresh(current.refreshToken, "student")).resolves.toBeDefined();
  });

  test("deactivating a user takes effect on the next authenticated request", async () => {
    const userId = await student();
    const tokens = await sessions().create(userId, "student");
    await sessions().authenticate(tokens.accessToken, "student");

    await testApp().database.prisma.user.update({
      where: { id: userId },
      data: { deactivatedAt: new Date() },
    });

    await expect(sessions().authenticate(tokens.accessToken, "student")).rejects.toMatchObject({
      status: 401,
    });
  });

  test("an admin session idle for more than the configured minutes is refused", async () => {
    const admin = await testApp().factories.admin();
    const tokens = await sessions().create(admin.id, "admin");
    await testApp().database.prisma.session.updateMany({
      where: { familyId: tokens.familyId },
      data: { createdAt: new Date(Date.now() - 31 * 60_000) },
    });

    await expect(sessions().refresh(tokens.refreshToken, "admin")).rejects.toMatchObject({
      status: 401,
    });
  });

  test("an admin family past the absolute cap is revoked on refresh even when it is still active", async () => {
    const admin = await testApp().factories.user({ role: "ADMIN" });
    const first = await sessions().create(admin.id, "admin");
    const second = await sessions().refresh(first.refreshToken, "admin");
    await testApp().database.prisma.session.update({
      where: { refreshTokenHash: hashRefreshToken(first.refreshToken) },
      data: { createdAt: new Date(Date.now() - 13 * 3_600_000) },
    });

    await expect(sessions().refresh(second.refreshToken, "admin")).rejects.toBeDefined();

    const rows = await testApp().database.prisma.session.findMany({
      where: { familyId: first.familyId },
    });
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  test("a student family within the cap keeps refreshing", async () => {
    const first = await sessions().create(await student(), "student");
    await testApp().database.prisma.session.update({
      where: { refreshTokenHash: hashRefreshToken(first.refreshToken) },
      data: { createdAt: new Date(Date.now() - 29 * 86_400_000) },
    });

    await expect(sessions().refresh(first.refreshToken, "student")).resolves.toBeDefined();
  });
});
