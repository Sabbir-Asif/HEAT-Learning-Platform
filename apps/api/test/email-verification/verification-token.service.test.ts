import { describe, expect, test, vi } from "vitest";
import { SecretBox } from "../../src/core";
import { hashOpaqueToken } from "../../src/auth";
import { VerificationTokenService } from "../../src/email-verification/verification-token.service";

const now = new Date("2026-11-10T00:00:00.000Z");
const box = new SecretBox(Buffer.alloc(32, 7));

const build = (issuedCount = 0) => {
  const tx = {
    authToken: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(issuedCount),
    },
  };
  const service = new VerificationTokenService(
    { verification: { tokenTtlHours: 48 } } as never,
    { now: () => now } as never,
    box,
  );
  return { service, tx };
};

describe("VerificationTokenService.issue", () => {
  test("stores only the hash and seals the plain token", async () => {
    const { service, tx } = build();

    const issued = await service.issue(tx as never, { id: "user-id", createdAt: now });

    const stored = tx.authToken.create.mock.calls[0]?.[0].data;
    const plain = box.decrypt(issued?.encryptedToken ?? "");
    expect(plain).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored).toEqual({
      userId: "user-id",
      purpose: "VERIFY_EMAIL",
      tokenHash: hashOpaqueToken(plain),
      expiresAt: new Date(now.getTime() + 48 * 3_600_000),
    });
    expect(JSON.stringify(stored)).not.toContain(plain);
  });

  test("marks earlier unused tokens used before inserting, and never deletes", async () => {
    const { service, tx } = build();

    await service.issue(tx as never, { id: "user-id", createdAt: now });

    expect(tx.authToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-id", purpose: "VERIFY_EMAIL", usedAt: null },
      data: { usedAt: now },
    });
    expect(tx.authToken.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.authToken.create.mock.invocationCallOrder[0] ?? 0,
    );
    expect("deleteMany" in tx.authToken).toBe(false);
  });

  test("issues nothing once the seven day registration window has closed", async () => {
    const { service, tx } = build();

    const issued = await service.issue(tx as never, {
      id: "user-id",
      createdAt: new Date(now.getTime() - 8 * 24 * 3_600_000),
    });

    expect(issued).toBeNull();
    expect(tx.authToken.create).not.toHaveBeenCalled();
  });
});

describe("VerificationTokenService.resendsExhausted", () => {
  test.each([
    [1, false],
    [5, false],
    [6, true],
  ])("with %i tokens on record the answer is %s", async (count, expected) => {
    const { service, tx } = build(count);

    expect(await service.resendsExhausted(tx as never, "user-id")).toBe(expected);
  });
});
