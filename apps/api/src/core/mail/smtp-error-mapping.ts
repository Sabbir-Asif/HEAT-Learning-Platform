import type { MailFailureKind } from "./mail-transport";

interface MappedFailure {
  status: MailFailureKind;
  responseCode: number | null;
}

const permanentCodes: ReadonlySet<string> = new Set(["EAUTH", "EENVELOPE", "EMESSAGE"]);

const quotaEnhancedStatus = /(?:^|\s|-)5\.4\.5(?:\s|$)/;

export const parseResponseCode = (response: string): number | null => {
  const match = /^(\d{3})(?:[\s-]|$)/.exec(response);
  return match?.[1] === undefined ? null : Number(match[1]);
};

const readField = (error: unknown, field: string): unknown =>
  typeof error === "object" && error !== null ? Reflect.get(error, field) : undefined;

export const mapSmtpError = (error: unknown): MappedFailure => {
  const rawCode = readField(error, "responseCode");
  const response = readField(error, "response");
  const responseCode = typeof rawCode === "number" ? rawCode : null;
  if (responseCode !== null) {
    if (
      responseCode === 550 &&
      typeof response === "string" &&
      quotaEnhancedStatus.test(response.slice(3))
    ) {
      return { status: "quota-exceeded", responseCode };
    }
    if (responseCode >= 400 && responseCode < 500) {
      return { status: "transient-failure", responseCode };
    }
    if (responseCode >= 500 && responseCode < 600) {
      return { status: "permanent-failure", responseCode };
    }
  }
  const code = readField(error, "code");
  if (typeof code === "string" && permanentCodes.has(code)) {
    return { status: "permanent-failure", responseCode: null };
  }
  return { status: "transient-failure", responseCode: null };
};
