import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import { findUserIdsByEmail } from "@heat/db";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import type { AuditActor } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { PasswordService, SessionService } from "../auth";
import { SignInLockout } from "../rate-limit";
import type { SessionMetadata, SessionTokens } from "../auth";

export interface SignedInAdmin {
  userId: string;
  tokens: SessionTokens;
}

@Injectable()
export class AdminSignInService implements OnModuleInit {
  private readonly logger = new Logger(AdminSignInService.name);
  private decoyDigest = "";

  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly lockout: SignInLockout,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.decoyDigest = await this.passwords.hash(randomBytes(24).toString("base64"));
  }

  async signIn(
    email: string,
    password: string,
    metadata: SessionMetadata,
    actor: AuditActor,
  ): Promise<SignedInAdmin> {
    await this.lockout.reserve("admin", email, metadata.ipAddress);
    const user = await this.database.user.findFirst({
      where: {
        id: { in: await findUserIdsByEmail(this.database, email) },
        realm: "ADMIN",
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
        deactivatedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, passwordHash: true },
    });
    const matches = await this.passwords.verify(user?.passwordHash ?? this.decoyDigest, password);
    if (user === null || !matches) {
      throw new ApiException(401, "INVALID_CREDENTIALS");
    }
    await this.lockout.recordSuccess("admin", email, metadata.ipAddress);
    await this.upgradeDigest(user.id, user.passwordHash, password);
    const tokens = await this.sessions.create(user.id, "admin", metadata);
    try {
      await this.audit.recordStandalone(
        { ...actor, actorId: user.id },
        { action: "admin.sign-in", entity: "User", entityId: user.id },
      );
    } catch (error) {
      await this.sessions.revoke(tokens.familyId);
      throw error;
    }
    return { userId: user.id, tokens };
  }

  private async upgradeDigest(userId: string, digest: string, password: string): Promise<void> {
    if (!this.passwords.needsRehash(digest)) return;
    try {
      const upgraded = await this.passwords.hash(password);
      await this.database.user.update({ where: { id: userId }, data: { passwordHash: upgraded } });
    } catch {
      this.logger.warn("Password hash could not be upgraded");
    }
  }
}
