import { describe, expect, test } from "vitest";
import { verificationResendRequestSchema, verifyEmailRequestSchema } from "../src/index";

const captcha = { captchaId: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", captchaAnswer: "AB12" };

describe("verifyEmailRequestSchema", () => {
  test("accepts a token and rejects an empty or oversized one", () => {
    expect(verifyEmailRequestSchema.safeParse({ token: "abc" }).success).toBe(true);
    expect(verifyEmailRequestSchema.safeParse({ token: "" }).success).toBe(false);
    expect(verifyEmailRequestSchema.safeParse({ token: "a".repeat(513) }).success).toBe(false);
    expect(verifyEmailRequestSchema.safeParse({ token: "a".repeat(512) }).success).toBe(true);
  });
});

describe("verificationResendRequestSchema", () => {
  test("normalises the email and requires the captcha fields", () => {
    expect(
      verificationResendRequestSchema.parse({ email: " Anne@Example.com ", ...captcha }).email,
    ).toBe("anne@example.com");
    expect(verificationResendRequestSchema.safeParse({ email: "a@b.test" }).success).toBe(false);
    expect(verificationResendRequestSchema.safeParse({ email: "nope", ...captcha }).success).toBe(
      false,
    );
  });
});
