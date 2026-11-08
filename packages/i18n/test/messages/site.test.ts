import { describe, expect, test } from "vitest";
import { flattenKeys, messages } from "../../src/index";

describe("site catalog", () => {
  test("holds the title, the home heading and the language switch label", () => {
    expect(Object.keys(flattenKeys({ site: messages.en.site }))).toEqual([
      "site.home.heading",
      "site.localeSwitch.label",
      "site.title",
    ]);
  });

  test("bn is written in Bangla script", () => {
    for (const value of Object.values(flattenKeys(messages.bn.site)))
      expect(/[ঀ-৿]/.test(value)).toBe(true);
  });
});
