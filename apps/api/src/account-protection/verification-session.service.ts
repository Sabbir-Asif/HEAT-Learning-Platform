import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { SessionService } from "../auth";
import type { SessionMetadata, SessionTokens } from "../auth";
import { CLOCK, DATABASE } from "../core";
import type { Clock } from "../core";

export type VerificationSessionWriter = Pick<HeatClient, "session">;

@Injectable()
export class VerificationSessionService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sessions: SessionService,
  ) {}

  verificationTimestamp(): Date {
    return this.clock.now();
  }

  async revokeSessionsBeforeVerification(
    userId: string,
    emailVerifiedAt: Date,
    writer: VerificationSessionWriter = this.database,
  ): Promise<void> {
    const earlier = await writer.session.findMany({
      where: { userId, createdAt: { lt: emailVerifiedAt } },
      select: { familyId: true },
      distinct: ["familyId"],
    });
    if (earlier.length === 0) return;
    await writer.session.updateMany({
      where: { userId, familyId: { in: earlier.map((row) => row.familyId) }, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  issueSessionAfterCommit(userId: string, metadata: SessionMetadata = {}): Promise<SessionTokens> {
    return this.sessions.create(userId, "student", metadata);
  }
}
