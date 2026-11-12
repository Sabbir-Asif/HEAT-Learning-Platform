import { isIP } from "node:net";
import type { CertificateVerificationResponse } from "@heat/contracts";

export interface VerificationModel {
  heading: string;
  note: string;
  valid: boolean;
  rows: { label: string; value: string }[];
}

const completedFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Dhaka",
});

export const toVerificationModel = (
  verification: CertificateVerificationResponse,
  number: string,
): VerificationModel => {
  const valid = verification.status === "VALID";
  return {
    heading: valid ? "This certificate is valid" : "This certificate was revoked",
    note: valid
      ? `Certificate ${number} was issued by the HEAT training programme.`
      : `Certificate ${number} is no longer valid. Do not accept it as proof of completion.`,
    valid,
    rows: [
      { label: "Name", value: verification.holderName },
      { label: "Course", value: verification.courseTitle },
      { label: "Completed", value: completedFormat.format(new Date(verification.completedAt)) },
    ],
  };
};

export const isNotFoundFailure = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "NOT_FOUND";

export const isRateLimitedFailure = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "RATE_LIMITED";

export const decodeCertificateNumber = (raw: string): string | null => {
  try {
    return decodeURIComponent(raw).trim().toUpperCase();
  } catch {
    return null;
  }
};

export const visitorAddressHeaders = (incoming: Headers): Record<string, string> => {
  const real = incoming.get("x-real-ip")?.trim() ?? "";
  const forwarded = incoming.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
  const address = isIP(real) !== 0 ? real : forwarded;
  return isIP(address) !== 0 ? { "x-forwarded-for": address } : {};
};
