import { createHmac, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import type { AuthRealm } from "./auth.types";

@Injectable()
export class CsrfTokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  issue(realm: AuthRealm, familyId: string): string {
    return createHmac("sha256", this.config.csrf.secret)
      .update(`csrf:${realm}:${familyId}`)
      .digest("base64url");
  }

  verify(realm: AuthRealm, familyId: string, candidate: string): boolean {
    const expected = Buffer.from(this.issue(realm, familyId));
    const given = Buffer.from(candidate);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }
}
