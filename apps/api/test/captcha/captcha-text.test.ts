import { describe, expect, test } from "vitest";
import {
  alphabet,
  captchaLength,
  generateCaptchaText,
  normaliseAnswer,
} from "../../src/captcha/captcha-text";
import { StubEntropy } from "../support/fakes";

describe("captcha text", () => {
  test("leaves out look-alike characters", () => {
    for (const banned of ["0", "O", "1", "I", "L", "Q", "S", "Z", "B", "G"]) {
      expect(alphabet).not.toContain(banned);
    }
    expect(alphabet).toBe([...new Set(alphabet)].join(""));
  });

  test("generates the fixed length from the alphabet", () => {
    const text = generateCaptchaText(new StubEntropy([0, 7, 13, 21, 25, 40]));

    expect(text).toHaveLength(captchaLength);
    for (const character of text) expect(alphabet).toContain(character);
  });

  test("normalises case and whitespace", () => {
    expect(normaliseAnswer("  a b\tc3 \n")).toBe("ABC3");
  });
});
