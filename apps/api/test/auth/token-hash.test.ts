import { describe, expect, test } from "vitest";
import { generateRefreshToken, hashRefreshToken, safeEqualHex } from "../../src/auth/token-hash";

describe("token hashing", () => {
  test("hashes to 64 lowercase hex characters, deterministically", () => {
    const hash = hashRefreshToken("abc");
    expect(hash).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  test("generates distinct url-safe tokens", () => {
    const a = generateRefreshToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(generateRefreshToken());
  });

  test("compares equal, different and different length values", () => {
    expect(safeEqualHex("aa", "aa")).toBe(true);
    expect(safeEqualHex("aa", "ab")).toBe(false);
    expect(safeEqualHex("aa", "aaa")).toBe(false);
  });
});
