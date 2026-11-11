import { createTransport } from "nodemailer";
import type { MailConfig } from "./mail-config";
import { maskAddress } from "./mask-address";
import type {
  MailMessage,
  MailSendResult,
  MailTransport,
  MailVerifyResult,
} from "./mail-transport";
import { mapSmtpError, parseResponseCode } from "./smtp-error-mapping";

export interface SmtpSendOptions {
  from: { address: string; name: string };
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmtpClient {
  sendMail(options: SmtpSendOptions): Promise<{ response: string; rejected: readonly unknown[] }>;
  verify(): Promise<unknown>;
}

export interface SmtpTransportLogger {
  log(line: string): void;
  warn(line: string): void;
}

const defaultAcceptedCode = 250;
const rejectedRecipientCode = 550;

export const createSmtpClient = (config: MailConfig): SmtpClient =>
  createTransport({
    host: config.host,
    port: config.port,
    secure: config.tls === "implicit",
    requireTLS: config.tls === "starttls",
    ignoreTLS: config.tls === "none",
    auth: config.auth === null ? undefined : { user: config.auth.user, pass: config.auth.password },
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
  });

export class SmtpMailTransport implements MailTransport {
  constructor(
    private readonly client: SmtpClient,
    private readonly config: MailConfig,
    private readonly logger: SmtpTransportLogger,
  ) {}

  async send(message: MailMessage): Promise<MailSendResult> {
    const recipient = maskAddress(message.to);
    try {
      const info = await this.client.sendMail({
        from: this.config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html === undefined ? {} : { html: message.html }),
      });
      if (info.rejected.length > 0) {
        this.logger.warn(`Mail rejected recipient=${recipient} code=${rejectedRecipientCode}`);
        return { status: "permanent-failure", responseCode: rejectedRecipientCode };
      }
      const responseCode = parseResponseCode(info.response) ?? defaultAcceptedCode;
      this.logger.log(`Mail sent recipient=${recipient} code=${responseCode}`);
      return { status: "sent", responseCode };
    } catch (error) {
      const failure = mapSmtpError(error);
      this.logger.warn(
        `Mail not sent recipient=${recipient} status=${failure.status} code=${failure.responseCode ?? "none"}`,
      );
      return failure;
    }
  }

  async verify(): Promise<MailVerifyResult> {
    try {
      await this.client.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, failure: mapSmtpError(error).status };
    }
  }
}
