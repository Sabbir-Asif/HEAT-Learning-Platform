import { describe, expect, test } from "vitest";
import { isActiveEmailConflict } from "../../src/account-protection";

const knownRequest = (code: string, target?: unknown) =>
  Object.assign(new Error("failed"), { code, meta: target === undefined ? {} : { target } });

describe("isActiveEmailConflict", () => {
  test("recognises a unique violation on the active email index", () => {
    expect(isActiveEmailConflict(knownRequest("P2002", "User_email_active_key"))).toBe(true);
    expect(isActiveEmailConflict(knownRequest("P2002", ["email"]))).toBe(true);
  });

  test("recognises a unique violation without a target", () => {
    expect(isActiveEmailConflict(knownRequest("P2002"))).toBe(true);
  });

  test("rejects other unique violations, other codes and non errors", () => {
    expect(isActiveEmailConflict(knownRequest("P2002", ["tokenHash"]))).toBe(false);
    expect(isActiveEmailConflict(knownRequest("P2025"))).toBe(false);
    expect(isActiveEmailConflict(new Error("plain"))).toBe(false);
    expect(isActiveEmailConflict("P2002")).toBe(false);
    expect(isActiveEmailConflict(null)).toBe(false);
  });
});
