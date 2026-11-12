import type { EmailCategory } from "./email-template";

export const quotaWindowMs = 24 * 3600_000;
const emptyLedgerResumeMs = 3600_000;

const priorityCategories: ReadonlySet<EmailCategory> = new Set(["VERIFICATION", "PASSWORD"]);

export interface EmailQuotaConfig {
  totalLimit: number;
  reservedForPriority: number;
  budgets: Record<EmailCategory, number>;
}

export interface QuotaEntry {
  id: string;
  category: EmailCategory;
  at: Date;
}

export interface QuotaLedger {
  record(category: EmailCategory, at: Date): Promise<string>;
  release(id: string): Promise<void>;
  entriesSince(since: Date): Promise<QuotaEntry[]>;
}

export type Reservation =
  { granted: true; reservationId: string } | { granted: false; retryAt: Date };

export interface QuotaStatus {
  used: number;
  remainingTotal: number;
  remaining: Record<EmailCategory, number>;
}

const expiryOf = (entry: QuotaEntry): Date => new Date(entry.at.getTime() + quotaWindowMs);

const expiryToFreeSlot = (entries: QuotaEntry[], limit: number): Date => {
  const blocking = entries[entries.length - Math.max(limit, 0) - 1] ?? entries[0];
  return blocking === undefined ? new Date(0) : expiryOf(blocking);
};

const later = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b);

export class EmailQuota {
  constructor(
    private readonly ledger: QuotaLedger,
    private readonly config: EmailQuotaConfig,
  ) {}

  async reserve(category: EmailCategory, now: Date): Promise<Reservation> {
    const entries = await this.inWindow(now);
    const ofCategory = entries.filter((entry) => entry.category === category);
    const totalAllowed = priorityCategories.has(category)
      ? this.config.totalLimit
      : this.config.totalLimit - this.config.reservedForPriority;
    const budget = this.config.budgets[category];

    let retryAt: Date | null = null;
    if (entries.length >= totalAllowed) {
      retryAt = expiryToFreeSlot(entries, totalAllowed);
    }
    if (ofCategory.length >= budget) {
      const categoryRetry = expiryToFreeSlot(ofCategory, budget);
      retryAt = retryAt === null ? categoryRetry : later(retryAt, categoryRetry);
    }
    if (retryAt !== null) return { granted: false, retryAt };

    return { granted: true, reservationId: await this.ledger.record(category, now) };
  }

  release(reservationId: string): Promise<void> {
    return this.ledger.release(reservationId);
  }

  async resumeAt(now: Date): Promise<Date> {
    const [oldest] = await this.inWindow(now);
    return oldest === undefined ? new Date(now.getTime() + emptyLedgerResumeMs) : expiryOf(oldest);
  }

  async status(now: Date): Promise<QuotaStatus> {
    const entries = await this.inWindow(now);
    const countOf = (category: EmailCategory): number =>
      entries.filter((entry) => entry.category === category).length;
    const remainingTotal = Math.max(this.config.totalLimit - entries.length, 0);
    const remainingForOthers = Math.max(
      this.config.totalLimit - this.config.reservedForPriority - entries.length,
      0,
    );
    const remaining = {} as Record<EmailCategory, number>;
    for (const category of Object.keys(this.config.budgets) as EmailCategory[]) {
      const ceiling = priorityCategories.has(category) ? remainingTotal : remainingForOthers;
      remaining[category] = Math.min(
        Math.max(this.config.budgets[category] - countOf(category), 0),
        ceiling,
      );
    }
    return { used: entries.length, remainingTotal, remaining };
  }

  private inWindow(now: Date): Promise<QuotaEntry[]> {
    return this.ledger.entriesSince(new Date(now.getTime() - quotaWindowMs));
  }
}
