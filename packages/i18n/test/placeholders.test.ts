import { describe, expect, test } from "vitest";
import { placeholderNames } from "../src/placeholders";

describe("placeholderNames", () => {
  test.each([
    ["Hello", []],
    ["Hello {name}", ["name"]],
    ["{b} and {a} and {b}", ["a", "b"]],
    ["{ name }", ["name"]],
    ["{count, number}", ["count"]],
    ["{when, date, short}", ["when"]],
    ["{count, plural, one {# item} other {# items}}", ["count"]],
    [
      "{count, plural, =0 {none} one {{name} has # item} other {{name} has # items}}",
      ["count", "name"],
    ],
    ["{gender, select, female {{who} her} male {{who} his} other {their}}", ["gender", "who"]],
    ["'{notAPlaceholder}' and {real}", ["real"]],
    ["it''s {name}", ["name"]],
    ["no braces at all", []],
    ["stray } close", []],
    ["{unterminated", []],
  ])("%j has the placeholders %j", (message, expected) => {
    expect(placeholderNames(message)).toEqual(expected);
  });

  test("a deeply nested message does not overflow", () => {
    const message = `${"{a, select, other {".repeat(200)}x${"}}".repeat(200)}`;
    expect(placeholderNames(message)).toEqual(["a"]);
  });
});
