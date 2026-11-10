import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { PasswordService, SessionService } from "../auth";
import { CLOCK, DATABASE } from "../core";
import { SignInLockout } from "../rate-limit";
import type { Clock } from "../core";

export class RecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryError";
  }
}

export interface RecoveryOptions {
  hostname: string;
  email?: string;
}

export interface RecoveryResult {
  email: string;
  temporaryPassword: string;
  lockoutCleared: boolean;
}

@Injectable()
export class RecoverSuperAdminService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly lockout: SignInLockout,
  ) {}

  async recover(options: RecoveryOptions): Promise<RecoveryResult> {
    const target = await this.select(options.email);
    const temporaryPassword = randomBytes(24).toString("base64url");
    const passwordHash = await this.passwords.hash(temporaryPassword);
    await this.sessions.revokeAll(target.id);
    await this.database.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { passwordHash, mustChangePassword: true },
      });
      await this.audit.record(
        tx,
        { actorId: null },
        {
          action: "admin.break-glass.recover",
          entity: "User",
          entityId: target.id,
          after: {
            method: "break-glass-cli",
            host: options.hostname,
            at: this.clock.now().toISOString(),
            forcedChange: true,
            sessionsRevoked: true,
          },
        },
      );
    });
    const lockoutCleared = await this.lockout.clearAccount("admin", target.email).then(
      () => true,
      () => false,
    );
    return { email: target.email, temporaryPassword, lockoutCleared };
  }

  private async select(email: string | undefined): Promise<{ id: string; email: string }> {
    const candidates = await this.database.user.findMany({
      where: {
        role: "SUPER_ADMIN",
        realm: "ADMIN",
        deletedAt: null,
        ...(email === undefined ? {} : { email: { equals: email, mode: "insensitive" } }),
      },
      select: { id: true, email: true, deactivatedAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (candidates.length === 0) {
      throw new RecoveryError(
        email === undefined
          ? "No super admin exists. Nothing was changed."
          : "No super admin has that email. Nothing was changed.",
      );
    }
    const [only] = candidates;
    if (candidates.length > 1 || only === undefined) {
      throw new RecoveryError(
        `More than one super admin exists (${candidates.map((user) => user.email).join(", ")}). Select one with --email. Nothing was changed.`,
      );
    }
    if (only.deactivatedAt !== null) {
      throw new RecoveryError(
        "That super admin is deactivated. Reactivate the account first. Nothing was changed.",
      );
    }
    return only;
  }
}
