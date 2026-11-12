import { describe, expect, test } from "vitest";
import { landingOverviewFailedMessage } from "../../src/site-pages/landing-overview-copy";

describe("landingOverviewFailedMessage", () => {
  test("explains disallowed content", () => {
    expect(landingOverviewFailedMessage("VALIDATION_FAILED")).toBe(
      "The text contains content that is not allowed.",
    );
  });

  test("asks to wait when rate limited", () => {
    expect(landingOverviewFailedMessage("RATE_LIMITED")).toMatch(/wait/i);
  });

  test("falls back to a retry message", () => {
    expect(landingOverviewFailedMessage(undefined)).toBe(
      "The overview could not be saved. Try again.",
    );
  });
});
