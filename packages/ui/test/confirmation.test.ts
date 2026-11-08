import { describe, expect, test } from "vitest";
import { isNameConfirmation, nameConfirmationApplies } from "../src/composites/confirmation";

describe("typed-name confirmation", () => {
  test("accepts the exact name after trimming", () => {
    expect(isNameConfirmation("Intro to HEAT", "  Intro to HEAT ")).toBe(true);
  });

  test("is case sensitive", () => {
    expect(isNameConfirmation("Intro to HEAT", "intro to heat")).toBe(false);
  });

  test("rejects a partial name", () => {
    expect(isNameConfirmation("Intro to HEAT", "Intro")).toBe(false);
  });

  test("compares after Unicode NFC normalisation", () => {
    expect(isNameConfirmation("Café", "Café")).toBe(true);
  });

  test("applies only to a non-empty name of at most 80 characters", () => {
    expect(nameConfirmationApplies("Intro")).toBe(true);
    expect(nameConfirmationApplies("")).toBe(false);
    expect(nameConfirmationApplies("   ")).toBe(false);
    expect(nameConfirmationApplies("a".repeat(81))).toBe(false);
    expect(nameConfirmationApplies(undefined)).toBe(false);
  });
});
