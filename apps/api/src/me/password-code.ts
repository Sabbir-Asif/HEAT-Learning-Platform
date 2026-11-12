import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { passwordCodeLength, passwordCodeLifetimeMinutes } from "@heat/contracts";

export const PASSWORD_CODE_PURPOSE = "PASSWORD_CODE";
export const PASSWORD_CODE_TEMPLATE = "password-change-code";
export const PASSWORD_CODE_EVENT_TYPE = "student.password.code";
export const PASSWORD_CODE_REQUEST_LIMIT = 5;
export const PASSWORD_CODE_REQUEST_WINDOW_MS = 3_600_000;
export const PASSWORD_CHANGE_AUDIT_ACTION = "student.password.change";

export const generatePasswordCode = (): string =>
  randomInt(0, 10 ** passwordCodeLength)
    .toString()
    .padStart(passwordCodeLength, "0");

const digest = (salt: string, code: string): Buffer =>
  createHash("sha256").update(`${salt}:${code}`).digest();

export const sealPasswordCode = (code: string): string => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}.${digest(salt, code).toString("hex")}`;
};

export const passwordCodeMatches = (stored: string, candidate: string): boolean => {
  const [salt, expected] = stored.split(".");
  if (salt === undefined || expected === undefined) return false;
  const wanted = Buffer.from(expected, "hex");
  const actual = digest(salt, candidate);
  return wanted.length === actual.length && timingSafeEqual(wanted, actual);
};

export const passwordCodeExpiry = (now: Date): Date =>
  new Date(now.getTime() + passwordCodeLifetimeMinutes * 60_000);

export const attemptsKey = (tokenId: string): string => `password-code:attempts:${tokenId}`;

export const remainingSeconds = (expiresAt: Date, now: Date): number =>
  Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
