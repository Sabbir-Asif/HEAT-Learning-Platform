import { describe, expect, test } from "vitest";
import { serializeLocaleCookie } from "../src/cookie";

describe("serializeLocaleCookie", () => {
  test.each(["bn", "en"] as const)("writes the %s preference as a host-bound cookie", (locale) => {
    expect(serializeLocaleCookie(locale)).toBe(
      `__Host-locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
    );
  });

  test("carries no Domain and no HttpOnly attribute", () => {
    const cookie = serializeLocaleCookie("bn");
    expect(cookie).not.toMatch(/domain/i);
    expect(cookie).not.toMatch(/httponly/i);
  });

  test.each(["fr", "BN", "", "bn; Domain=evil.example", "bn\r\nSet-Cookie: a=b"])(
    "refuses the value %j",
    (value) => {
      expect(() => serializeLocaleCookie(value as never)).toThrow(TypeError);
    },
  );
});
