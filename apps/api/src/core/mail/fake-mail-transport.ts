import type {
  MailMessage,
  MailSendResult,
  MailTransport,
  MailVerifyResult,
} from "./mail-transport";

export class FakeMailTransport implements MailTransport {
  readonly sent: MailMessage[] = [];
  readonly attempts: MailMessage[] = [];
  verifyResult: MailVerifyResult = { ok: true };
  private readonly queued: MailSendResult[] = [];

  enqueue(result: MailSendResult): void {
    this.queued.push(result);
  }

  send(message: MailMessage): Promise<MailSendResult> {
    this.attempts.push(message);
    const result = this.queued.shift() ?? { status: "sent", responseCode: 250 };
    if (result.status === "sent") this.sent.push(message);
    return Promise.resolve(result);
  }

  verify(): Promise<MailVerifyResult> {
    return Promise.resolve(this.verifyResult);
  }
}
