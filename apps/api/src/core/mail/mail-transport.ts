export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export type MailFailureKind = "quota-exceeded" | "transient-failure" | "permanent-failure";

export type MailSendResult =
  | { status: "sent"; responseCode: number }
  | { status: MailFailureKind; responseCode: number | null };

export type MailVerifyResult = { ok: true } | { ok: false; failure: MailFailureKind };

export interface MailTransport {
  send(message: MailMessage): Promise<MailSendResult>;
  verify(): Promise<MailVerifyResult>;
}

export const MAIL_TRANSPORT = Symbol("MAIL_TRANSPORT");
