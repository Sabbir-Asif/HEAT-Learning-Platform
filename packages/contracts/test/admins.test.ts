import { describe, expect, test } from "vitest";
import {
  acceptInviteRequestSchema,
  adminListQuerySchema,
  invitationLookupRequestSchema,
  inviteAdminRequestSchema,
  passwordMinLength,
} from "../src/index";

describe("inviteAdminRequestSchema", () => {
  test("trims and lower-cases the email", () => {
    expect(inviteAdminRequestSchema.parse({ email: "  New.Admin@Example.TEST " }).email).toBe(
      "new.admin@example.test",
    );
  });

  test("rejects a malformed email", () => {
    expect(inviteAdminRequestSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("acceptInviteRequestSchema", () => {
  test("requires a token and a password of the minimum length", () => {
    expect(
      acceptInviteRequestSchema.safeParse({
        token: "t".repeat(43),
        password: "x".repeat(passwordMinLength),
      }).success,
    ).toBe(true);
    expect(
      acceptInviteRequestSchema.safeParse({ token: "t".repeat(43), password: "short" }).success,
    ).toBe(false);
    expect(
      acceptInviteRequestSchema.safeParse({ token: "", password: "x".repeat(passwordMinLength) })
        .success,
    ).toBe(false);
  });
});

describe("adminListQuerySchema", () => {
  test("applies defaults and coerces numbers from the query string", () => {
    expect(adminListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 25 });
    expect(adminListQuerySchema.parse({ page: "2", pageSize: "10", sort: "-email" })).toEqual({
      page: 2,
      pageSize: 10,
      sort: "-email",
    });
  });

  test("rejects an unknown page size or sort", () => {
    expect(adminListQuerySchema.safeParse({ pageSize: "7" }).success).toBe(false);
    expect(adminListQuerySchema.safeParse({ sort: "passwordHash" }).success).toBe(false);
  });
});

describe("invitationLookupRequestSchema", () => {
  test("needs a bounded non-empty token", () => {
    expect(invitationLookupRequestSchema.parse({ token: "abc" })).toEqual({ token: "abc" });
    expect(invitationLookupRequestSchema.safeParse({ token: "" }).success).toBe(false);
    expect(invitationLookupRequestSchema.safeParse({ token: "x".repeat(129) }).success).toBe(false);
  });
});
