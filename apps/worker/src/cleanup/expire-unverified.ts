import type { Clock } from "api/core";

export const EXPIRY_DAYS = 7;
const dayMs = 24 * 60 * 60 * 1000;

export interface ExpiryCandidate {
  userId: string;
  verificationJob: { status: string; sentAt: Date | null } | null;
  enrollments: { id: string; status: string }[];
}

export interface ExpiryStore {
  loadCandidates(): Promise<ExpiryCandidate[]>;
  apply(userId: string, enrollmentIds: string[], deleteAccount: boolean, at: Date): Promise<number>;
}

export interface ExpiryMetric {
  add(count: number): Promise<void>;
}

const hasExpired = (candidate: ExpiryCandidate, cutoff: Date): boolean => {
  const job = candidate.verificationJob;
  if (job === null || job.status !== "SENT" || job.sentAt === null) return false;
  return job.sentAt.getTime() <= cutoff.getTime();
};

const keepsAccountAlive = (candidate: ExpiryCandidate): boolean =>
  candidate.enrollments.some(
    (enrollment) => enrollment.status === "APPROVED" || enrollment.status === "COMPLETED",
  );

export class ExpireUnverifiedRegistrations {
  constructor(
    private readonly store: ExpiryStore,
    private readonly metric: ExpiryMetric,
    private readonly clock: Clock,
  ) {}

  async run(): Promise<number> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - EXPIRY_DAYS * dayMs);
    const candidates = await this.store.loadCandidates();
    let expired = 0;
    for (const candidate of candidates) {
      const pending = candidate.enrollments.filter(
        (enrollment) => enrollment.status === "PENDING_VERIFICATION",
      );
      if (pending.length === 0 || !hasExpired(candidate, cutoff)) continue;
      expired += await this.store.apply(
        candidate.userId,
        pending.map((enrollment) => enrollment.id),
        !keepsAccountAlive(candidate),
        now,
      );
    }
    if (expired > 0) await this.metric.add(expired);
    return expired;
  }
}
