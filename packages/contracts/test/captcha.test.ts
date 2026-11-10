import { describe, expect, test } from "vitest";
import {
  captchaAnswerMaxLength,
  captchaFieldsSchema,
  captchaMaxTries,
  captchaRequestSchema,
  captchaResponseSchema,
  captchaTtlSeconds,
} from "../src/index";

const id = "6f1c1c1e-4d3a-4c55-8a39-0d3c2f9b1a11";

describe("captcha contracts", () => {
  test("states the lifetime and try limit", () => {
    expect(captchaTtlSeconds).toBe(300);
    expect(captchaMaxTries).toBe(3);
  });

  test("a refresh request may name the id it replaces", () => {
    expect(captchaRequestSchema.safeParse({}).success).toBe(true);
    expect(captchaRequestSchema.safeParse({ replaces: id }).success).toBe(true);
    expect(captchaRequestSchema.safeParse({ replaces: "nope" }).success).toBe(false);
  });

  test("the response carries an id, the image and the lifetime", () => {
    expect(
      captchaResponseSchema.safeParse({ id, svg: "<svg/>", expiresInSeconds: 300 }).success,
    ).toBe(true);
    expect(captchaResponseSchema.safeParse({ id, svg: "<svg/>" }).success).toBe(false);
  });

  test("the protected request fields trim the answer and bound its length", () => {
    const parsed = captchaFieldsSchema.parse({ captchaId: id, captchaAnswer: "  AB3K7  " });
    expect(parsed.captchaAnswer).toBe("AB3K7");
    expect(captchaFieldsSchema.safeParse({ captchaId: id, captchaAnswer: "" }).success).toBe(false);
    expect(
      captchaFieldsSchema.safeParse({
        captchaId: id,
        captchaAnswer: "a".repeat(captchaAnswerMaxLength + 1),
      }).success,
    ).toBe(false);
    expect(
      captchaFieldsSchema.safeParse({ captchaId: "x", captchaAnswer: "AB3K7" }).success,
    ).toBe(false);
  });
});
