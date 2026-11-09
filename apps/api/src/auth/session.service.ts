import { randomUUID } from "node:crypto";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { z } from "zod";
import { APP_CONFIG, CLOCK, SecretBox } from "../core";
import type { AppConfig, Clock } from "../core";
import { AccessTokenService } from "./access-token.service";
import type { AuthenticatedSession, AuthRealm, SessionMetadata, SessionTokens } from "./auth.types";
import { RotationClaimStore } from "./rotation-claim.store";
import { SessionStore } from "./session.store";
import type { NewSession, RealmName, SessionRow, SessionUserRow } from "./session.store";
import { generateRefreshToken, hashRefreshToken, safeEqualHex } from "./token-hash";

const realmNames: Record<AuthRealm, RealmName> = { student: "STUDENT", admin: "ADMIN" };
const realmByName: Record<RealmName, AuthRealm> = { STUDENT: "student", ADMIN: "admin" };

const claimKey = (refreshTokenHash: string): string => `auth:rotation:${refreshTokenHash}`;

const storedTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  familyId: z.uuid(),
  accessExpiresAt: z.coerce.date(),
  refreshExpiresAt: z.coerce.date(),
});

const rejected = (): UnauthorizedException => new UnauthorizedException();

const isUsable = (user: SessionUserRow | null, realm: AuthRealm): user is SessionUserRow =>
  user !== null &&
  user.deactivatedAt === null &&
  user.deletedAt === null &&
  user.realm === realmNames[realm];

@Injectable()
export class SessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly store: SessionStore,
    private readonly claims: RotationClaimStore,
    private readonly accessTokens: AccessTokenService,
    private readonly secretBox: SecretBox,
  ) {}

  async create(
    userId: string,
    realm: AuthRealm,
    metadata: SessionMetadata = {},
  ): Promise<SessionTokens> {
    const user = await this.store.findUser(userId);
    if (!isUsable(user, realm)) throw rejected();
    const refreshToken = generateRefreshToken();
    const session = this.newSession(userId, randomUUID(), refreshToken, metadata);
    await this.store.insert(session);
    return this.issue(userId, realm, refreshToken, session);
  }

  async refresh(refreshToken: string, realm: AuthRealm): Promise<SessionTokens> {
    const hash = hashRefreshToken(refreshToken);
    const row = await this.store.findByHash(hash);
    if (row === null || !safeEqualHex(row.refreshTokenHash, hash) || row.revokedAt !== null) {
      throw rejected();
    }
    const user = await this.store.findUser(row.userId);
    if (!isUsable(user, realm)) throw rejected();
    if (row.rotatedAt !== null) return this.replay(row, hash);
    return this.rotate(row, hash, realm);
  }

  async authenticate(accessToken: string, realm: AuthRealm): Promise<AuthenticatedSession> {
    const claims = await this.accessTokens.verify(accessToken, realm);
    const latest = await this.store.findLatest(claims.familyId);
    if (
      latest === null ||
      latest.userId !== claims.userId ||
      latest.revokedAt !== null ||
      latest.expiresAt <= this.clock.now()
    ) {
      throw rejected();
    }
    const user = await this.store.findUser(claims.userId);
    if (!isUsable(user, realm)) throw rejected();
    return {
      userId: user.id,
      familyId: claims.familyId,
      realm: realmByName[user.realm],
      role: user.role,
    };
  }

  revoke(familyId: string): Promise<void> {
    return this.store.revokeFamily(familyId, this.clock.now());
  }

  revokeAll(userId: string): Promise<void> {
    return this.store.revokeUser(userId, this.clock.now());
  }

  revokeAllExceptCurrent(userId: string, currentFamilyId: string): Promise<void> {
    return this.store.revokeUserExcept(userId, currentFamilyId, this.clock.now());
  }

  private async replay(row: SessionRow, hash: string): Promise<SessionTokens> {
    const sealed = await this.claims.read(claimKey(hash));
    if (sealed === null) {
      await this.store.revokeFamily(row.familyId, this.clock.now());
      throw rejected();
    }
    return this.open(sealed);
  }

  private async rotate(row: SessionRow, hash: string, realm: AuthRealm): Promise<SessionTokens> {
    const now = this.clock.now();
    if (row.expiresAt <= now) throw rejected();
    if (realm === "admin" && now.getTime() - row.createdAt.getTime() > this.idleMilliseconds()) {
      await this.store.revokeFamily(row.familyId, now);
      throw rejected();
    }
    const refreshToken = generateRefreshToken();
    const next = this.newSession(row.userId, row.familyId, refreshToken);
    const tokens = await this.issue(row.userId, realm, refreshToken, next);
    const key = claimKey(hash);
    const won = await this.claims.claim(
      key,
      this.secretBox.encrypt(JSON.stringify(tokens)),
      this.config.auth.refreshGraceSeconds,
    );
    if (!won) {
      const sealed = await this.claims.read(key);
      if (sealed === null) throw rejected();
      return this.open(sealed);
    }
    try {
      if (await this.store.rotate(row.id, now, next)) return tokens;
    } catch (error) {
      await this.claims.release(key);
      throw error;
    }
    await this.claims.release(key);
    throw rejected();
  }

  private open(sealed: string): SessionTokens {
    return storedTokensSchema.parse(JSON.parse(this.secretBox.decrypt(sealed)));
  }

  private idleMilliseconds(): number {
    return this.config.auth.adminIdleMinutes * 60_000;
  }

  private newSession(
    userId: string,
    familyId: string,
    refreshToken: string,
    metadata: SessionMetadata = {},
  ): NewSession {
    const createdAt = this.clock.now();
    const lifetime = this.config.auth.refreshTokenTtlDays * 86_400_000;
    return {
      userId,
      familyId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      createdAt,
      expiresAt: new Date(createdAt.getTime() + lifetime),
      ...metadata,
    };
  }

  private async issue(
    userId: string,
    realm: AuthRealm,
    refreshToken: string,
    session: NewSession,
  ): Promise<SessionTokens> {
    const access = await this.accessTokens.sign({ userId, familyId: session.familyId, realm });
    return {
      accessToken: access.token,
      refreshToken,
      familyId: session.familyId,
      accessExpiresAt: access.expiresAt,
      refreshExpiresAt: session.expiresAt,
    };
  }
}
