import type { AdminStatus, AdminSummary } from "@heat/contracts";

export interface AdminRow {
  id: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STUDENT";
  createdAt: Date;
  deactivatedAt: Date | null;
  authTokens: ReadonlyArray<{ expiresAt: Date }>;
}

export const statusOf = (row: AdminRow, now: Date): AdminStatus => {
  if (row.deactivatedAt !== null) return "DEACTIVATED";
  const pending = row.authTokens[0];
  if (pending === undefined) return "ACTIVE";
  return pending.expiresAt <= now ? "INVITE_EXPIRED" : "INVITED";
};

export const toSummary = (row: AdminRow, now: Date): AdminSummary => ({
  id: row.id,
  email: row.email,
  role: row.role,
  status: statusOf(row, now),
  createdAt: row.createdAt.toISOString(),
  inviteExpiresAt:
    row.deactivatedAt === null && row.authTokens[0] !== undefined
      ? row.authTokens[0].expiresAt.toISOString()
      : null,
  deactivatedAt: row.deactivatedAt?.toISOString() ?? null,
});

export const adminRowSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  deactivatedAt: true,
  authTokens: {
    where: { purpose: "INVITE" as const, usedAt: null },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { expiresAt: true },
  },
};
