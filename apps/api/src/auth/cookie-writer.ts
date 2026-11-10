import {
  adminCsrf,
  adminSessionCookies,
  studentCsrf,
  studentSessionCookies,
} from "@heat/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import type { AuthRealm, SessionTokens } from "./auth.types";
import { CsrfTokenService } from "./csrf-token.service";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: string;
  maxAge?: number;
}

export interface CookieResponse {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: Omit<CookieOptions, "maxAge">): unknown;
}

interface RealmCookies {
  access: string;
  refresh: string;
  refreshPath: string;
}

export const realmCookies: Record<AuthRealm, RealmCookies> = {
  student: studentSessionCookies,
  admin: adminSessionCookies,
};

export const realmCsrfCookies: Record<AuthRealm, string> = {
  student: studentCsrf.cookie,
  admin: adminCsrf.cookie,
};

@Injectable()
export class CookieWriter {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly csrf: CsrfTokenService,
  ) {}

  write(response: CookieResponse, realm: AuthRealm, tokens: SessionTokens): void {
    const names = realmCookies[realm];
    response.cookie(names.access, tokens.accessToken, {
      ...this.accessOptions(),
      maxAge: this.config.auth.accessTokenTtlSeconds * 1000,
    });
    response.cookie(names.refresh, tokens.refreshToken, {
      ...this.refreshOptions(names),
      maxAge: this.config.auth.refreshTokenTtlDays * 86_400_000,
    });
    this.writeCsrf(response, realm, tokens.familyId);
  }

  writeCsrf(response: CookieResponse, realm: AuthRealm, familyId: string): string {
    const token = this.csrf.issue(realm, familyId);
    response.cookie(realmCsrfCookies[realm], token, {
      ...this.csrfOptions(),
      maxAge: this.config.auth.refreshTokenTtlDays * 86_400_000,
    });
    return token;
  }

  clear(response: CookieResponse, realm: AuthRealm): void {
    const names = realmCookies[realm];
    response.clearCookie(names.access, this.accessOptions());
    response.clearCookie(names.refresh, this.refreshOptions(names));
    response.clearCookie(realmCsrfCookies[realm], this.csrfOptions());
  }

  private csrfOptions(): Omit<CookieOptions, "maxAge"> {
    return { httpOnly: false, secure: true, sameSite: "strict", path: "/" };
  }

  private accessOptions(): Omit<CookieOptions, "maxAge"> {
    return { httpOnly: true, secure: true, sameSite: "lax", path: "/" };
  }

  private refreshOptions(names: RealmCookies): Omit<CookieOptions, "maxAge"> {
    return { httpOnly: true, secure: true, sameSite: "strict", path: names.refreshPath };
  }
}
