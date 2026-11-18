import { describe, expect, test } from "vitest";
import { quizSettingsFailedMessage } from "../../src/settings/settings-copy";

describe("quizSettingsFailedMessage", () => {
  test("names the field for a validation failure", () => {
    expect(quizSettingsFailedMessage("VALIDATION_FAILED")).toContain("attempt limit");
  });

  test("asks to wait when rate limited", () => {
    expect(quizSettingsFailedMessage("RATE_LIMITED")).toContain("Wait a moment");
  });

  test("falls back to a generic retry message", () => {
    expect(quizSettingsFailedMessage(undefined)).toContain("Try again");
  });
});
