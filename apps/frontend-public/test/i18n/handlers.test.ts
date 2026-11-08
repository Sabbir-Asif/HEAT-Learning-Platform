import { IntlError, IntlErrorCode } from "next-intl";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getMessageFallback, onError } from "../../src/i18n/handlers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("onError", () => {
  test("logs a structured line with the code and the message and does not throw", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new IntlError(IntlErrorCode.MISSING_MESSAGE, "Could not resolve `site.nope`");
    expect(() => onError(error)).not.toThrow();
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toEqual({
      event: "i18n.error",
      code: "MISSING_MESSAGE",
      message: error.message,
    });
  });

  test("handles every error code the same way", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    onError(new IntlError(IntlErrorCode.FORMATTING_ERROR, "bad"));
    expect(JSON.parse(String(log.mock.calls[0]?.[0])).code).toBe("FORMATTING_ERROR");
  });
});

describe("getMessageFallback", () => {
  const error = new IntlError(IntlErrorCode.MISSING_MESSAGE, "missing");

  test.each([
    [{ namespace: "site", key: "title" }, "site.title"],
    [{ namespace: "site.home", key: "heading" }, "site.home.heading"],
    [{ namespace: undefined, key: "title" }, "title"],
  ])("returns the dotted path for %j", (input, expected) => {
    expect(getMessageFallback({ ...input, error })).toBe(expected);
  });
});
