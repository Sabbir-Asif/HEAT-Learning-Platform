export { FakeMailTransport } from "./fake-mail-transport";
export { loadMailConfig, type MailConfig, type MailTlsMode } from "./mail-config";
export { MailConnectionCheck, WorkerMailConnectionCheck } from "./mail-connection-check";
export { maskAddress } from "./mask-address";
export {
  MAIL_TRANSPORT,
  type MailAttachment,
  type MailFailureKind,
  type MailMessage,
  type MailSendResult,
  type MailTransport,
  type MailVerifyResult,
} from "./mail-transport";
export { mapSmtpError } from "./smtp-error-mapping";
export { createSmtpClient, SmtpMailTransport } from "./smtp-mail-transport";
