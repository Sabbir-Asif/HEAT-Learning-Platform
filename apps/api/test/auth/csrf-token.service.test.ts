import { describe, expect, test } from "vitest";
import { CsrfTokenService } from "../../src/auth/csrf-token.service";
import { testConfig } from "../support/auth-fixtures";

const familyA = "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6a";
const familyB = "0190b3a2-7c1e-7a55-9a3b-1f2e3d4c5b6b";

describe("CsrfTokenService", () => {
  const service = new CsrfTokenService(testConfig());

  test("issues a stable url-safe token for one session", () => {
    const token = service.issue("student", familyA);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(service.issue("student", familyA)).toBe(token);
  });

  test("verifies the token of the same session", () => {
    expect(service.verify("student", familyA, service.issue("student", familyA))).toBe(true);
  });

  test("refuses a token issued for another session", () => {
    expect(service.verify("student", familyB, service.issue("student", familyA))).toBe(false);
  });

  test("refuses a token issued for the other realm", () => {
    expect(service.verify("admin", familyA, service.issue("student", familyA))).toBe(false);
  });

  test("refuses a token made with another secret", () => {
    const other = new CsrfTokenService(
      testConfig({ CSRF_SECRET: "other-csrf-secret-0123456789-abcdefghijklmno" }),
    );

    expect(service.verify("student", familyA, other.issue("student", familyA))).toBe(false);
  });

  test("refuses empty, short and long values without throwing", () => {
    const token = service.issue("student", familyA);

    expect(service.verify("student", familyA, "")).toBe(false);
    expect(service.verify("student", familyA, token.slice(1))).toBe(false);
    expect(service.verify("student", familyA, `${token}x`)).toBe(false);
  });
});
