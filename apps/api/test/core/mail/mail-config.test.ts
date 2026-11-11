import { describe, expect, test } from "vitest";
import { loadMailConfig } from "../../../src/core/mail/mail-config";

describe("loadMailConfig", () => {
  test("defaults to the local Mailpit without credentials outside production", () => {
    expect(loadMailConfig({})).toEqual({
      host: "localhost",
      port: 1035,
      tls: "none",
      auth: null,
      from: { address: "noreply@heat.localhost", name: "HEAT" },
      timeoutMs: 10000,
    });
  });

  test("reads a Gmail style configuration", () => {
    expect(
      loadMailConfig({
        SMTP_HOST: "smtp.gmail.com",
        SMTP_PORT: "587",
        SMTP_TLS: "starttls",
        SMTP_USER: "sender@example.test",
        SMTP_PASSWORD: "app-password-value",
        SMTP_FROM_ADDRESS: "sender@example.test",
        SMTP_FROM_NAME: "HEAT Training",
        SMTP_TIMEOUT_MS: "5000",
      }),
    ).toEqual({
      host: "smtp.gmail.com",
      port: 587,
      tls: "starttls",
      auth: { user: "sender@example.test", password: "app-password-value" },
      from: { address: "sender@example.test", name: "HEAT Training" },
      timeoutMs: 5000,
    });
  });

  test.each(["none", "starttls", "implicit"])("accepts the %s TLS mode", (SMTP_TLS) => {
    expect(loadMailConfig({ SMTP_TLS }).tls).toBe(SMTP_TLS);
  });

  test.each([
    [{ SMTP_TLS: "ssl" }, "SMTP_TLS"],
    [{ SMTP_PORT: "0" }, "SMTP_PORT"],
    [{ SMTP_PORT: "mail" }, "SMTP_PORT"],
    [{ SMTP_FROM_ADDRESS: "not-an-address" }, "SMTP_FROM_ADDRESS"],
    [{ SMTP_TIMEOUT_MS: "-1" }, "SMTP_TIMEOUT_MS"],
    [{ SMTP_USER: "sender@example.test" }, "SMTP_PASSWORD"],
    [{ SMTP_PASSWORD: "app-password-value" }, "SMTP_USER"],
  ])("refuses %j and names only %s", (env, name) => {
    expect(() => loadMailConfig(env)).toThrow(`Invalid environment configuration: ${name}`);
  });

  test("never echoes the password in an error", () => {
    expect(() => loadMailConfig({ SMTP_PASSWORD: "super-secret-value", SMTP_TLS: "x" })).toThrow(
      expect.not.objectContaining({ message: expect.stringContaining("super-secret-value") }),
    );
  });

  test("requires host, sender and credentials in production", () => {
    expect(() => loadMailConfig({ NODE_ENV: "production" })).toThrow(
      "Invalid environment configuration: SMTP_HOST, SMTP_FROM_ADDRESS, SMTP_USER, SMTP_PASSWORD",
    );
    expect(
      loadMailConfig({
        NODE_ENV: "production",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_FROM_ADDRESS: "sender@example.test",
        SMTP_USER: "sender@example.test",
        SMTP_PASSWORD: "app-password-value",
      }).host,
    ).toBe("smtp.gmail.com");
  });
});
