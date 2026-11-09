import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { SessionStore } from "./session.store";
import type { NewSession, SessionRow, SessionUserRow } from "./session.store";

const sessionSelect = {
  id: true,
  userId: true,
  familyId: true,
  refreshTokenHash: true,
  createdAt: true,
  expiresAt: true,
  rotatedAt: true,
  revokedAt: true,
} as const;

const toData = (session: NewSession) => ({
  userId: session.userId,
  familyId: session.familyId,
  refreshTokenHash: session.refreshTokenHash,
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
  userAgent: session.userAgent ?? null,
  ipAddress: session.ipAddress ?? null,
});

@Injectable()
export class PrismaSessionStore extends SessionStore {
  constructor(@Inject(DATABASE) private readonly database: HeatClient) {
    super();
  }

  findByHash(refreshTokenHash: string): Promise<SessionRow | null> {
    return this.database.session.findUnique({
      where: { refreshTokenHash },
      select: sessionSelect,
    });
  }

  findLatest(familyId: string): Promise<SessionRow | null> {
    return this.database.session.findFirst({
      where: { familyId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: sessionSelect,
    });
  }

  findUser(userId: string): Promise<SessionUserRow | null> {
    return this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        realm: true,
        role: true,
        deactivatedAt: true,
        deletedAt: true,
        mustChangePassword: true,
      },
    });
  }

  async insert(session: NewSession): Promise<void> {
    await this.database.session.create({ data: toData(session) });
  }

  rotate(previousId: string, rotatedAt: Date, next: NewSession): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const marked = await tx.session.updateMany({
        where: { id: previousId, rotatedAt: null, revokedAt: null },
        data: { rotatedAt },
      });
      if (marked.count !== 1) return false;
      await tx.session.create({ data: toData(next) });
      return true;
    });
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.database.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeUser(userId: string, at: Date): Promise<void> {
    await this.database.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeUserExcept(userId: string, keepFamilyId: string, at: Date): Promise<void> {
    await this.database.session.updateMany({
      where: { userId, familyId: { not: keepFamilyId }, revokedAt: null },
      data: { revokedAt: at },
    });
  }
}
