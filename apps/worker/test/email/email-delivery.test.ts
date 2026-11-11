import { FakeMailTransport } from "api/core";
import { describe, expect, test } from "vitest";
import {
  EmailDelivery,
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

const snapshot = (overrides: Partial<EmailJobSnapshot> = {}): EmailJobSnapshot => ({
  id: "job-1",
  status: "QUEUED",
  template: "admin-invitation",
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

const setup = (job: EmailJobSnapshot | null = snapshot()) => {
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
    { now: () => now },
  );
  return { store, transport, delivery, rendered };
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

  test("treats a quota error as a delay", async () => {
    const { store, transport, delivery } = setup();
    transport.enqueue({ status: "quota-exceeded", responseCode: 550 });
    expect(await delivery.deliver("job-1", false)).toBe("delayed");
    expect(store.log[1]).toBe("delayed job-1 550");
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
      { now: () => now },
    );

    expect(await delivery.deliver("job-1", false)).toBe("failed");

    expect(transport.attempts).toEqual([]);
    expect(store.log).toEqual([`failed job-1 null ${now.toISOString()}`]);
  });
});
