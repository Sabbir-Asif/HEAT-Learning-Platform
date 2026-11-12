export const PASSWORD_RESET_PURPOSE = "RESET_PASSWORD";
export const PASSWORD_RESET_EMAIL_TEMPLATE = "password-reset";
export const PASSWORD_RESET_REQUEST_EVENT_TYPE = "student.password.reset.requested";
export const PASSWORD_RESET_AUDIT_ACTION = "student.password.reset";
export const PASSWORD_RESET_EMAIL_CAP = 3;
export const PASSWORD_RESET_CAP_WINDOW_MS = 3_600_000;

export type ResetTokenRow = { purpose: string; usedAt: Date | null; expiresAt: Date };

export type ResetTokenFailure = "invalid" | "used" | "expired";

export const resetExpiry = (now: Date, ttlMinutes: number): Date =>
  new Date(now.getTime() + ttlMinutes * 60_000);

export const capWindowStart = (now: Date): Date =>
  new Date(now.getTime() - PASSWORD_RESET_CAP_WINDOW_MS);

export const emailCapReached = (recentRequests: number): boolean =>
  recentRequests >= PASSWORD_RESET_EMAIL_CAP;

export const classifyResetToken = (row: ResetTokenRow | null, now: Date): ResetTokenFailure => {
  if (row === null || row.purpose !== PASSWORD_RESET_PURPOSE) return "invalid";
  if (row.usedAt !== null) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "used";
};
