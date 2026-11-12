import { describe, expect, test } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { assertProfileEditable, isProfileLocked } from "../../src/me/profile-rules";

describe("isProfileLocked", () => {
  test("stays open until the first approval", () => {
    expect(isProfileLocked(0)).toBe(false);
  });

  test("locks once any approval exists", () => {
    expect(isProfileLocked(1)).toBe(true);
    expect(isProfileLocked(3)).toBe(true);
  });
});

describe("assertProfileEditable", () => {
  test("allows an unlocked profile", () => {
    expect(() => assertProfileEditable(false)).not.toThrow();
  });

  test("refuses a locked profile with the locked-field code", () => {
    try {
      assertProfileEditable(true);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiException);
      expect((error as ApiException).code).toBe("PROFILE_LOCKED");
      expect((error as ApiException).getStatus()).toBe(403);
    }
  });
});
