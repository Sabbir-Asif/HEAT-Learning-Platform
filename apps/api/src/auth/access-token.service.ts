import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { APP_CONFIG, CLOCK } from "../core";
import type { AppConfig, Clock } from "../core";
import { authRealms } from "./auth.types";
import type { AuthRealm } from "./auth.types";

const issuer = "heat-lms";

const claimsSchema = z.object({
  sub: z.uuid(),
  sid: z.uuid(),
  aud: z.enum(authRealms),
});

export interface AccessTokenClaims {
  userId: string;
  familyId: string;
  realm: AuthRealm;
}

export interface SignedAccessToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AccessTokenService {
  private readonly secret: Uint8Array;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.secret = new TextEncoder().encode(config.auth.accessSecret);
  }

  async sign(claims: AccessTokenClaims): Promise<SignedAccessToken> {
    const issuedAt = Math.floor(this.clock.now().getTime() / 1000);
    const expiresAt = issuedAt + this.config.auth.accessTokenTtlSeconds;
    const token = await new SignJWT({ sid: claims.familyId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(claims.userId)
      .setAudience(claims.realm)
      .setIssuer(issuer)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.secret);
    return { token, expiresAt: new Date(expiresAt * 1000) };
  }

  async verify(token: string, realm: AuthRealm): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ["HS256"],
        audience: realm,
        issuer,
        currentDate: this.clock.now(),
      });
      const claims = claimsSchema.parse(payload);
      return { userId: claims.sub, familyId: claims.sid, realm: claims.aud };
    } catch {
      throw new UnauthorizedException();
    }
  }
}
