import { expect, test } from "vitest";
import { MailConnectionCheck } from "../../../src/core/mail/mail-connection-check";
import { FakeMailTransport } from "../../../src/core/mail/fake-mail-transport";
import type { MailConfig } from "../../../src/core/mail/mail-config";

const config: MailConfig = {
  host: "smtp.example.test",
  port: 587,
  tls: "starttls",
  auth: { user: "sender@example.test", password: "app-password-value" },
  from: { address: "sender@example.test", name: "HEAT" },
  timeoutMs: 10000,
};

const sink = () => {
  const lines: { level: "log" | "error"; line: string }[] = [];
  return {
    lines,
    log: (line: string) => lines.push({ level: "log", line }),
    error: (line: string) => lines.push({ level: "error", line }),
  };
};

test("logs the target server on success without secrets or the user name", async () => {
  const logger = sink();
  await new MailConnectionCheck(new FakeMailTransport(), config, logger).onApplicationBootstrap();
  expect(logger.lines).toEqual([
    { level: "log", line: "Mail transport ready host=smtp.example.test port=587 tls=starttls" },
  ]);
});

test("logs an error with the failure kind and does not throw", async () => {
  const transport = new FakeMailTransport();
  transport.verifyResult = { ok: false, failure: "transient-failure" };
  const logger = sink();
  await expect(
    new MailConnectionCheck(transport, config, logger).onApplicationBootstrap(),
  ).resolves.toBeUndefined();
  expect(logger.lines).toEqual([
    {
      level: "error",
      line: "Mail transport unreachable host=smtp.example.test port=587 tls=starttls reason=transient-failure",
    },
  ]);
  expect(JSON.stringify(logger.lines)).not.toContain("app-password-value");
});
