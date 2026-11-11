import { describe, expect, test } from "vitest";
import { FakeMailTransport } from "../../../src/core/mail/fake-mail-transport";

const message = { to: "learner@example.test", subject: "Hi", text: "Hello" };

describe("FakeMailTransport", () => {
  test("records sent messages and reports sent by default", async () => {
    const transport = new FakeMailTransport();
    await expect(transport.send(message)).resolves.toEqual({ status: "sent", responseCode: 250 });
    expect(transport.sent).toEqual([message]);
  });

  test("returns queued results in order and records only sent messages", async () => {
    const transport = new FakeMailTransport();
    transport.enqueue({ status: "quota-exceeded", responseCode: 550 });
    transport.enqueue({ status: "transient-failure", responseCode: 421 });
    expect((await transport.send(message)).status).toBe("quota-exceeded");
    expect((await transport.send(message)).status).toBe("transient-failure");
    expect((await transport.send(message)).status).toBe("sent");
    expect(transport.sent).toHaveLength(1);
    expect(transport.attempts).toHaveLength(3);
  });

  test("verify reports ok unless told otherwise", async () => {
    const transport = new FakeMailTransport();
    await expect(transport.verify()).resolves.toEqual({ ok: true });
    transport.verifyResult = { ok: false, failure: "permanent-failure" };
    await expect(transport.verify()).resolves.toEqual({ ok: false, failure: "permanent-failure" });
  });
});
