import { FakeMailTransport } from "api/core";
import { describe, expect, test } from "vitest";
import { AttachmentUnavailable } from "../../src/email/certificate-attachment";
import { EmailQuota, type QuotaEntry, type QuotaLedger } from "../../src/email/email-quota";
import {
  EmailCapacityWait,
  EmailDelivery,
  EmailQuotaPause,
  type DeliveryStatus,
  type EmailDeliveryStore,
  type EmailJobSnapshot,
} from "../../src/email/email-delivery";

class FakeStore implements EmailDeliveryStore {
  readonly log: string[] = [];
  constructor(public job: EmailJobSnapshot | null) {}

  load(): Promise<EmailJobSnapshot | null> {
    return Promise.resolve(this.job);
  }
  markSending(id: string): Promise<void> {
    this.log.push(`sending ${id}`);
    return Promise.resolve();
  }
  markDelayed(id: string, smtpResponse: string | null): Promise<void> {
    this.log.push(`delayed ${id} ${String(smtpResponse)}`);
    return Promise.resolve();
  }
  markSent(id: string, smtpResponse: string, at: Date): Promise<void> {
    this.log.push(`sent ${id} ${smtpResponse} ${at.toISOString()}`);
    return Promise.resolve();
  }
  markFailed(id: string, smtpResponse: string | null, at: Date): Promise<void> {
    this.log.push(`failed ${id} ${String(smtpResponse)} ${at.toISOString()}`);
    return Promise.resolve();
  }
}

const now = new Date("2026-11-11T10:00:00Z");

class MemoryLedger implements QuotaLedger {
  readonly entries = new Map<string, QuotaEntry>();
  record(category: QuotaEntry["category"], at: Date): Promise<string> {
    const id = `e${String(this.entries.size + 1)}`;
    this.entries.set(id, { id, category, at });
    return Promise.resolve(id);
  }
  release(id: string): Promise<void> {
    this.entries.delete(id);
    return Promise.resolve();
  }
  entriesSince(since: Date): Promise<QuotaEntry[]> {
    return Promise.resolve(
      [...this.entries.values()].filter((entry) => entry.at.getTime() > since.getTime()),
    );
  }
}

const quotaConfig = {
  totalLimit: 10,
  reservedForPriority: 0,
  budgets: { VERIFICATION: 10, PASSWORD: 10, ENROLLMENT: 10, CERTIFICATE: 10 },
};

const snapshot = (overrides: Partial<EmailJobSnapshot> = {}): EmailJobSnapshot => ({
  id: "job-1",
  status: "QUEUED",
  template: "admin-invitation",
  category: "PASSWORD",
  recipientAddress: "rahim@du.ac.bd",
  recipientName: null,
  payload: {
    template: "admin-invitation",
    userId: "u1",
    expiresAt: "2026-11-14T06:00:00.000Z",
    encryptedToken: "sealed",
  },
  ...overrides,
});

const setup = (
  job: EmailJobSnapshot | null = snapshot(),
  config: typeof quotaConfig = quotaConfig,
) => {
  const ledger = new MemoryLedger();
  const quota = new EmailQuota(ledger, config);
  const store = new FakeStore(job);
  const transport = new FakeMailTransport();
  const rendered: { template: string; variables: unknown }[] = [];
  const delivery = new EmailDelivery(
    store,
    transport,
    (template, variables) => {
      rendered.push({ template, variables });
      return Promise.resolve({ subject: "Subject", html: "<p>Hi</p>", text: "Hi" });
    },
    (sealed) => `plain-${sealed}`,
    quota,
    { now: () => now },
  );
  return { store, transport, delivery, rendered, ledger };
};

describe("EmailDelivery", () => {
  test("renders with unsealed token and a name fallback, sends, and logs sent with the SMTP code", async () => {
    const { store, transport, delivery, rendered } = setup();

    expect(await delivery.deliver("job-1", false)).toBe("sent");

    expect(rendered[0]).toEqual({
      template: "admin-invitation",
      variables: { expiresAt: "2026-11-14T06:00:00.000Z", name: "rahim", token: "plain-sealed" },
    });
    expect(transport.sent).toEqual([
      { to: "rahim@du.ac.bd", subject: "Subject", html: "<p>Hi</p>", text: "Hi" },
    ]);
    expect(store.log).toEqual(["sending job-1", `sent job-1 250 ${now.toISOString()}`]);
  });

  test("unseals an encrypted code into the code variable and keeps the sealed value out", async () => {
    const { delivery, rendered } = setup(
      snapshot({
        template: "password-change-code",
        payload: {
          template: "password-change-code",
          userId: "u1",
          encryptedCode: "sealed-code",
          expiresInMinutes: 15,
        },
      }),
    );

    await delivery.deliver("job-1", false);

    expect(rendered[0]?.variables).toEqual({
      expiresInMinutes: 15,
      name: "rahim",
      code: "plain-sealed-code",
    });
  });

  test("uses the profile name when there is one", async () => {
    const { delivery, rendered } = setup(snapshot({ recipientName: "Rahim Uddin" }));
    await delivery.deliver("job-1", false);
    expect(rendered[0]?.variables).toMatchObject({ name: "Rahim Uddin" });
  });

  test("logs failed with the response code on a permanent SMTP failure and does not retry", async () => {
    const { store, transport, delivery } = setup();
    transport.enqueue({ status: "permanent-failure", responseCode: 550 });

    expect(await delivery.deliver("job-1", false)).toBe("failed");

    expect(store.log).toEqual(["sending job-1", `failed job-1 550 ${now.toISOString()}`]);
  });

  test("delays on a transient failure and fails once the attempts are used up", async () => {
    const first = setup();
    first.transport.enqueue({ status: "transient-failure", responseCode: 421 });
    expect(await first.delivery.deliver("job-1", false)).toBe("delayed");
    expect(first.store.log).toEqual(["sending job-1", "delayed job-1 421"]);

    const last = setup();
    last.transport.enqueue({ status: "transient-failure", responseCode: null });
    expect(await last.delivery.deliver("job-1", true)).toBe("failed");
    expect(last.store.log[1]).toBe(`failed job-1 null ${now.toISOString()}`);
  });

  test("pauses the queue on a quota error, releases the slot and does not use up an attempt", async () => {
    const { store, transport, delivery, ledger } = setup();
    transport.enqueue({ status: "quota-exceeded", responseCode: 550 });

    await expect(delivery.deliver("job-1", true)).rejects.toBeInstanceOf(EmailQuotaPause);

    expect(store.log).toEqual(["sending job-1", "delayed job-1 550"]);
    expect(ledger.entries.size).toBe(0);
  });

  test("the quota pause lasts until the oldest counted email leaves the window", async () => {
    const { transport, delivery, ledger } = setup();
    const earlier = new Date(now.getTime() - 3600_000);
    await ledger.record("VERIFICATION", earlier);
    transport.enqueue({ status: "quota-exceeded", responseCode: 550 });

    const error = await delivery.deliver("job-1", false).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailQuotaPause);
    expect((error as EmailQuotaPause).until).toEqual(new Date(earlier.getTime() + 24 * 3600_000));
  });

  test("delays without sending when the category budget is used up", async () => {
    const config = { ...quotaConfig, budgets: { ...quotaConfig.budgets, PASSWORD: 1 } };
    const { store, transport, delivery, ledger } = setup(snapshot(), config);
    const earlier = new Date(now.getTime() - 3600_000);
    await ledger.record("PASSWORD", earlier);

    const error = await delivery.deliver("job-1", false).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(EmailCapacityWait);
    expect((error as EmailCapacityWait).retryAt).toEqual(
      new Date(earlier.getTime() + 24 * 3600_000),
    );
    expect(transport.attempts).toEqual([]);
    expect(store.log).toEqual(["delayed job-1 null"]);
  });

  test("keeps the slot after a successful send and frees it after a transient failure", async () => {
    const sent = setup();
    await sent.delivery.deliver("job-1", false);
    expect(sent.ledger.entries.size).toBe(1);

    const failed = setup();
    failed.transport.enqueue({ status: "transient-failure", responseCode: 421 });
    await failed.delivery.deliver("job-1", false);
    expect(failed.ledger.entries.size).toBe(0);
  });

  test("does not send again once the job is sent or failed, or when it is missing", async () => {
    for (const status of ["SENT", "FAILED"] as DeliveryStatus[]) {
      const { transport, delivery } = setup(snapshot({ status }));
      expect(await delivery.deliver("job-1", false)).toBe("skipped");
      expect(transport.attempts).toEqual([]);
    }
  });

  test("throws when the job row is not visible yet so the queue retries", async () => {
    const { transport, delivery } = setup(null);
    await expect(delivery.deliver("job-1", false)).rejects.toThrow("Email job job-1 not found");
    expect(transport.attempts).toEqual([]);
  });

  test("fails without sending when the template or its variables are invalid", async () => {
    const { store, transport } = setup();
    const delivery = new EmailDelivery(
      store,
      transport,
      () => Promise.reject(new Error("bad variables")),
      (sealed) => sealed,
      new EmailQuota(new MemoryLedger(), quotaConfig),
      { now: () => now },
    );

    expect(await delivery.deliver("job-1", false)).toBe("failed");

    expect(transport.attempts).toEqual([]);
    expect(store.log).toEqual([`failed job-1 null ${now.toISOString()}`]);
  });
});

describe("EmailDelivery attachments", () => {
  const attachment = {
    filename: "HEAT-certificate-ABC123.pdf",
    content: Buffer.from([1, 2, 3]),
    contentType: "application/pdf",
  };

  const build = (load: () => Promise<(typeof attachment)[]>) => {
    const store = new FakeStore(snapshot());
    const transport = new FakeMailTransport();
    const errors: { event: string; fields: Record<string, string> }[] = [];
    const delivery = new EmailDelivery(
      store,
      transport,
      () => Promise.resolve({ subject: "Subject", html: "<p>Hi</p>", text: "Hi" }),
      (sealed) => sealed,
      new EmailQuota(new MemoryLedger(), quotaConfig),
      { now: () => now },
      { load },
      { error: (event, fields) => errors.push({ event, fields }) },
    );
    return { store, transport, delivery, errors };
  };

  test("sends the loaded attachments with the message", async () => {
    const { transport, delivery } = build(() => Promise.resolve([attachment]));
    expect(await delivery.deliver("job-1", false)).toBe("sent");
    expect(transport.sent[0]?.attachments).toEqual([attachment]);
  });

  test("fails with a log entry and no send when the attachment is unavailable", async () => {
    const { store, transport, delivery, errors } = build(() =>
      Promise.reject(new AttachmentUnavailable("missing")),
    );

    expect(await delivery.deliver("job-1", false)).toBe("failed");

    expect(transport.attempts).toEqual([]);
    expect(store.log).toEqual([`failed job-1 null ${now.toISOString()}`]);
    expect(errors).toEqual([
      { event: "email.attachment-unavailable", fields: { emailJobId: "job-1", reason: "missing" } },
    ]);
  });
});
