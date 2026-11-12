import { describe, expect, test } from "vitest";
import {
  contactEmailHref,
  contactPhoneHref,
  contactSettingsRequestSchema,
  emptyContactSettings,
  hasContactDetails,
} from "../src/index";

const request = (overrides: Record<string, unknown> = {}) => ({
  organisation: "HEAT office",
  address: "Room 12, TSC, University of Dhaka",
  email: "heat@du.ac.bd",
  phone: "+880 2 5566 7788",
  officeHours: "Sunday to Thursday, 9:00 to 17:00",
  ...overrides,
});

describe("contactSettingsRequestSchema", () => {
  test("accepts complete details", () => {
    expect(contactSettingsRequestSchema.safeParse(request()).success).toBe(true);
  });

  test("accepts empty fields so details can be cleared", () => {
    expect(contactSettingsRequestSchema.safeParse(emptyContactSettings).success).toBe(true);
  });

  test("trims the values", () => {
    expect(contactSettingsRequestSchema.parse(request({ email: "  heat@du.ac.bd " })).email).toBe(
      "heat@du.ac.bd",
    );
  });

  test("rejects an invalid email with a message", () => {
    const result = contactSettingsRequestSchema.safeParse(request({ email: "not-an-email" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Enter a valid email address.");
  });

  test("rejects an invalid phone number with a message", () => {
    const result = contactSettingsRequestSchema.safeParse(request({ phone: "call me" }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("Enter a valid phone number");
  });

  test("rejects over-long text", () => {
    expect(
      contactSettingsRequestSchema.safeParse(request({ address: "a".repeat(501) })).success,
    ).toBe(false);
  });
});

describe("contact helpers", () => {
  test("detects whether anything was entered", () => {
    expect(hasContactDetails(emptyContactSettings)).toBe(false);
    expect(hasContactDetails(request() as typeof emptyContactSettings)).toBe(true);
  });

  test("builds mailto and tel links", () => {
    expect(contactEmailHref("heat@du.ac.bd")).toBe("mailto:heat@du.ac.bd");
    expect(contactPhoneHref("+880 2 5566-7788")).toBe("tel:+880255667788");
  });
});
