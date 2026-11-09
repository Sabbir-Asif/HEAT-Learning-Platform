import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const generateRefreshToken = (): string => randomBytes(32).toString("base64url");

export const hashRefreshToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const safeEqualHex = (left: string, right: string): boolean => {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
};
