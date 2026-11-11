import { Inject, Injectable } from "@nestjs/common";
import type { HeatClient } from "@heat/db";
import { generateOpaqueToken, hashOpaqueToken } from "../auth";
import { APP_CONFIG, CLOCK, SecretBox } from "../core";
import type { AppConfig, Clock } from "../core";
import {
  VERIFICATION_PURPOSE,
  VERIFICATION_RESEND_LIMIT,
  verificationExpiry,
} from "./verification-token";

export type VerificationTokenWriter = Pick<HeatClient, "authToken">;

export type IssuedVerification = { encryptedToken: string; expiresAt: Date };

@Injectable()
export class VerificationTokenService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly secretBox: SecretBox,
  ) {}

  async issue(
    tx: VerificationTokenWriter,
    user: { id: string; createdAt: Date },
  ): Promise<IssuedVerification | null> {
    const now = this.clock.now();
    const expiresAt = verificationExpiry(
      now,
      user.createdAt,
      this.config.verification.tokenTtlHours,
    );
    if (expiresAt.getTime() <= now.getTime()) return null;
    await tx.authToken.updateMany({
      where: { userId: user.id, purpose: VERIFICATION_PURPOSE, usedAt: null },
      data: { usedAt: now },
    });
    const token = generateOpaqueToken();
    await tx.authToken.create({
      data: {
        userId: user.id,
        purpose: VERIFICATION_PURPOSE,
        tokenHash: hashOpaqueToken(token),
        expiresAt,
      },
    });
    return { encryptedToken: this.secretBox.encrypt(token), expiresAt };
  }

  async resendsExhausted(tx: VerificationTokenWriter, userId: string): Promise<boolean> {
    const issued = await tx.authToken.count({
      where: { userId, purpose: VERIFICATION_PURPOSE },
    });
    return issued > VERIFICATION_RESEND_LIMIT;
  }
}
