import { describe, expect, test } from "vitest";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale } from "../src/locale";

describe("locale constants", () => {
  test("Bangla is the default and the cookie uses the host prefix", () => {
    expect(LOCALES).toEqual(["bn", "en"]);
    expect(DEFAULT_LOCALE).toBe("bn");
    expect(LOCALE_COOKIE).toBe("__Host-locale");
  });
});

describe("isLocale", () => {
  test.each(["bn", "en"])("accepts %s", (value) => {
    expect(isLocale(value)).toBe(true);
  });

  test.each(["BN", "En", "fr", "", " bn", "bn ", "bn-BD", "bn;x", "__proto__", "constructor"])(
    "rejects %j",
    (value) => {
      expect(isLocale(value)).toBe(false);
    },
  );

  test.each([undefined, null, 1, {}, ["bn"]])("rejects the non-string %j", (value) => {
    expect(isLocale(value)).toBe(false);
  });
});
