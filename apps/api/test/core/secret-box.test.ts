import { randomBytes } from "node:crypto";
import { describe, expect, test } from "vitest";
import { SecretBox } from "../../src/core/secret-box";

describe("SecretBox", () => {
  const box = new SecretBox(randomBytes(32));

  test("round-trips a value", () => {
    expect(box.decrypt(box.encrypt("JBSWY3DPEHPK3PXP"))).toBe("JBSWY3DPEHPK3PXP");
  });

  test("uses a fresh nonce each time and hides the plaintext", () => {
    const first = box.encrypt("same");
    expect(first).not.toBe(box.encrypt("same"));
    expect(Buffer.from(first, "base64url").toString("utf8")).not.toContain("same");
  });

  test("rejects a tampered value", () => {
    const bytes = Buffer.from(box.encrypt("secret"), "base64url");
    bytes[bytes.length - 1] ^= 1;
    expect(() => box.decrypt(bytes.toString("base64url"))).toThrow();
  });

  test("rejects a value sealed with another key", () => {
    expect(() => new SecretBox(randomBytes(32)).decrypt(box.encrypt("secret"))).toThrow();
  });

  test("rejects a truncated value", () => {
    expect(() => box.decrypt("AAAA")).toThrow("Sealed value is too short");
  });
});
