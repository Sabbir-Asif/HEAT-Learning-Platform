import { describe, expect, test } from "vitest";
import { newsSaveFailedMessage } from "../../src/news/news-copy";
import { newsStatusFromUrl } from "../../src/news/news-status";

describe("newsSaveFailedMessage", () => {
  test("explains disallowed content and missing image descriptions", () => {
    expect(newsSaveFailedMessage("VALIDATION_FAILED")).toMatch(/description/);
  });

  test("asks to wait when rate limited", () => {
    expect(newsSaveFailedMessage("RATE_LIMITED")).toMatch(/wait/i);
  });

  test("falls back to a retry message", () => {
    expect(newsSaveFailedMessage(undefined)).toBe("The post could not be saved. Try again.");
  });
});

describe("newsStatusFromUrl", () => {
  test("accepts the scheduled filter and falls back to all", () => {
    expect(newsStatusFromUrl("scheduled")).toBe("scheduled");
    expect(newsStatusFromUrl("nonsense")).toBe("all");
    expect(newsStatusFromUrl(undefined)).toBe("all");
  });
});
