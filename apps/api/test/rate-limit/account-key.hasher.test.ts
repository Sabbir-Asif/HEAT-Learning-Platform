import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { loadConfig } from "../../src/core";
import { AccountKeyHasher } from "../../src/rate-limit/account-key.hasher";
import { authTestEnvironment } from "../support/auth-env";

const config = loadConfig({
  ...authTestEnvironment,
  DATABASE_URL: "postgresql://x",
  REDIS_URL: "redis://x",
});

describe("AccountKeyHasher", () => {
  test("does not use the raw access secret as the key", () => {
    const raw = createHmac("sha256", config.auth.accessSecret)
      .update("email:a@b.test")
      .digest("hex");
    expect(new AccountKeyHasher(config).forEmail("a@b.test")).not.toBe(raw);
  });

  test("is stable, case-insensitive for email, and separates users from emails", () => {
    const hasher = new AccountKeyHasher(config);
    expect(hasher.forEmail(" A@B.test ")).toBe(hasher.forEmail("a@b.test"));
    expect(hasher.forUser("a@b.test")).not.toBe(hasher.forEmail("a@b.test"));
  });
});
