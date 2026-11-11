import { describe, expect, test } from "vitest";
import { SmtpMailTransport } from "../../../src/core/mail/smtp-mail-transport";
import type { SmtpClient, SmtpSendOptions } from "../../../src/core/mail/smtp-mail-transport";
import type { MailMessage } from "../../../src/core/mail/mail-transport";
import type { MailConfig } from "../../../src/core/mail/mail-config";

const config: MailConfig = {
  host: "smtp.example.test",
  port: 587,
  tls: "starttls",
  auth: { user: "sender@example.test", password: "app-password-value" },
  from: { address: "sender@example.test", name: "HEAT" },
  timeoutMs: 10000,
};

const message: MailMessage = {
  to: "learner@example.test",
  subject: "Welcome",
  text: "Hello",
  html: "<p>Hello</p>",
};

class FakeClient implements SmtpClient {
  sent: SmtpSendOptions[] = [];
  constructor(
    private readonly outcome: () => Promise<{ response: string; rejected: string[] }>,
    private readonly verifyOutcome: () => Promise<unknown> = () => Promise.resolve(true),
  ) {}
  sendMail(options: SmtpSendOptions) {
    this.sent.push(options);
    return this.outcome();
  }
  verify() {
    return this.verifyOutcome();
  }
}

const logger = () => {
  const lines: string[] = [];
  return {
    lines,
    log: (line: string) => lines.push(line),
    warn: (line: string) => lines.push(line),
  };
};

const accepted = () => Promise.resolve({ response: "250 2.0.0 OK 1 abc", rejected: [] });

describe("SmtpMailTransport.send", () => {
  test("hands the message and configured sender to the client and reports sent", async () => {
    const client = new FakeClient(accepted);
    const transport = new SmtpMailTransport(client, config, logger());
    await expect(transport.send(message)).resolves.toEqual({ status: "sent", responseCode: 250 });
    expect(client.sent).toEqual([
      {
        from: { address: "sender@example.test", name: "HEAT" },
        to: "learner@example.test",
        subject: "Welcome",
        text: "Hello",
        html: "<p>Hello</p>",
      },
    ]);
  });

  test("reports 250 when the server response has no code", async () => {
    const client = new FakeClient(() => Promise.resolve({ response: "queued", rejected: [] }));
    await expect(new SmtpMailTransport(client, config, logger()).send(message)).resolves.toEqual({
      status: "sent",
      responseCode: 250,
    });
  });

  test("reports a rejected recipient as permanent", async () => {
    const client = new FakeClient(() =>
      Promise.resolve({ response: "250 OK", rejected: ["learner@example.test"] }),
    );
    await expect(new SmtpMailTransport(client, config, logger()).send(message)).resolves.toEqual({
      status: "permanent-failure",
      responseCode: 550,
    });
  });

  test("maps a thrown 550 5.4.5 to quota-exceeded and a 421 to transient", async () => {
    const quota = new FakeClient(() =>
      Promise.reject(
        Object.assign(new Error("limit"), {
          responseCode: 550,
          response: "550 5.4.5 Daily user sending limit exceeded",
        }),
      ),
    );
    const busy = new FakeClient(() =>
      Promise.reject(Object.assign(new Error("busy"), { responseCode: 421, response: "421 busy" })),
    );
    expect((await new SmtpMailTransport(quota, config, logger()).send(message)).status).toBe(
      "quota-exceeded",
    );
    expect((await new SmtpMailTransport(busy, config, logger()).send(message)).status).toBe(
      "transient-failure",
    );
  });

  test("maps a connection timeout to transient", async () => {
    const client = new FakeClient(() =>
      Promise.reject(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" })),
    );
    await expect(new SmtpMailTransport(client, config, logger()).send(message)).resolves.toEqual({
      status: "transient-failure",
      responseCode: null,
    });
  });

  test("logs neither the password nor the full recipient address", async () => {
    const sink = logger();
    const failing = new FakeClient(() =>
      Promise.reject(
        Object.assign(new Error("bad learner@example.test app-password-value"), {
          responseCode: 535,
          response: "535 auth failed for learner@example.test",
        }),
      ),
    );
    await new SmtpMailTransport(new FakeClient(accepted), config, sink).send(message);
    await new SmtpMailTransport(failing, config, sink).send(message);
    const output = sink.lines.join("\n");
    expect(output).not.toContain("app-password-value");
    expect(output).not.toContain("learner@example.test");
    expect(output).toContain("l***@example.test");
  });
});

describe("SmtpMailTransport.verify", () => {
  test("reports ok and logs only host, port and TLS mode", async () => {
    const sink = logger();
    const transport = new SmtpMailTransport(new FakeClient(accepted), config, sink);
    await expect(transport.verify()).resolves.toEqual({ ok: true });
    expect(sink.lines.join("\n")).not.toContain("app-password-value");
  });

  test("reports a failure with its mapped kind and never throws", async () => {
    const client = new FakeClient(accepted, () =>
      Promise.reject(Object.assign(new Error("refused"), { code: "ECONNREFUSED" })),
    );
    await expect(new SmtpMailTransport(client, config, logger()).verify()).resolves.toEqual({
      ok: false,
      failure: "transient-failure",
    });
  });
});
