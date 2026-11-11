export const VERIFICATION_PURPOSE = "VERIFY_EMAIL";
export const VERIFICATION_REGISTRATION_WINDOW_MS = 7 * 24 * 3_600_000;
export const VERIFICATION_RESEND_LIMIT = 5;
export const VERIFICATION_EMAIL_TEMPLATE = "student-verification";
export const VERIFICATION_RESEND_EVENT_TYPE = "student.verification.resend";
export const EMAIL_VERIFIED_AUDIT_ACTION = "student.email.verified";

export type TokenRow = { purpose: string; usedAt: Date | null; expiresAt: Date };

export type TokenFailure = "invalid" | "used" | "expired";

export const verificationExpiry = (now: Date, registeredAt: Date, ttlHours: number): Date => {
  const byTtl = now.getTime() + ttlHours * 3_600_000;
  const byWindow = registeredAt.getTime() + VERIFICATION_REGISTRATION_WINDOW_MS;
  return new Date(Math.min(byTtl, byWindow));
};

export const classifyToken = (row: TokenRow | null, now: Date): TokenFailure => {
  if (row === null || row.purpose !== VERIFICATION_PURPOSE) return "invalid";
  if (row.usedAt !== null) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "used";
};
