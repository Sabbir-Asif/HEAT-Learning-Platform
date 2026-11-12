import type { HeatClient } from "@heat/db";
import type { ExpiryCandidate, ExpiryStore } from "./expire-unverified";

const verificationTemplate = "student-verification";

export class PrismaExpiryStore implements ExpiryStore {
  constructor(private readonly database: HeatClient) {}

  async loadCandidates(): Promise<ExpiryCandidate[]> {
    const users = await this.database.user.findMany({
      where: {
        realm: "STUDENT",
        emailVerifiedAt: null,
        enrollments: { some: { status: "PENDING_VERIFICATION", deletedAt: null } },
      },
      select: {
        id: true,
        enrollments: { where: { deletedAt: null }, select: { id: true, status: true } },
        emailJobs: {
          where: { category: "VERIFICATION", template: verificationTemplate },
          orderBy: { queuedAt: "desc" },
          take: 1,
          select: { status: true, sentAt: true },
        },
      },
    });
    return users.map((user) => ({
      userId: user.id,
      verificationJob: user.emailJobs[0] ?? null,
      enrollments: user.enrollments,
    }));
  }

  apply(
    userId: string,
    enrollmentIds: string[],
    deleteAccount: boolean,
    at: Date,
  ): Promise<number> {
    return this.database.$transaction(async (tx) => {
      const unverified = await tx.user.count({ where: { id: userId, emailVerifiedAt: null } });
      if (unverified === 0) return 0;
      const expired = await tx.enrollment.updateMany({
        where: { id: { in: enrollmentIds }, status: "PENDING_VERIFICATION" },
        data: { status: "EXPIRED", expiredAt: at },
      });
      if (deleteAccount && expired.count > 0) await tx.user.delete({ where: { id: userId } });
      return expired.count;
    });
  }
}
