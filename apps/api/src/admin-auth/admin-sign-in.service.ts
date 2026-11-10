import { randomBytes } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { OnModuleInit } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { PasswordService, SessionService } from "../auth";
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
  ) {}

  async onModuleInit(): Promise<void> {
    this.decoyDigest = await this.passwords.hash(randomBytes(24).toString("base64"));
  }

  async signIn(email: string, password: string, metadata: SessionMetadata): Promise<SignedInAdmin> {
    const user = await this.database.user.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        realm: "ADMIN",
        role: { in: ["ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
        deactivatedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, passwordHash: true },
    });
    const matches = await this.passwords.verify(user?.passwordHash ?? this.decoyDigest, password);
    if (user === null || !matches) throw new ApiException(401, "INVALID_CREDENTIALS");
    await this.upgradeDigest(user.id, user.passwordHash, password);
    const tokens = await this.sessions.create(user.id, "admin", metadata);
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
