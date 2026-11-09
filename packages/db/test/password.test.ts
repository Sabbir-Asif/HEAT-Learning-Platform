import { describe, expect, test } from "vitest";
import { hashPassword } from "../src/password";

describe("hashPassword", () => {
  test("produces an argon2id hash that does not contain the password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("correct horse");
  });

  test("uses OWASP-grade parameters", async () => {
    const hash = await hashPassword("another passphrase value");

    expect(hash).toMatch(/\$v=19\$m=19456,t=2,p=1\$/);
  });

  test("salts every hash", async () => {
    const first = await hashPassword("same passphrase value");
    const second = await hashPassword("same passphrase value");

    expect(first).not.toBe(second);
  });
});
