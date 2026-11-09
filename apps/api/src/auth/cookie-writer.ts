import { Inject, Injectable } from "@nestjs/common";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import type { AuthRealm, SessionTokens } from "./auth.types";

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
  student: {
    access: "__Host-heat_access",
    refresh: "__Secure-heat_refresh",
    refreshPath: "/api/auth/refresh",
  },
  admin: {
    access: "__Host-heat_admin_access",
    refresh: "__Secure-heat_admin_refresh",
    refreshPath: "/api/admin/auth/refresh",
  },
};

@Injectable()
export class CookieWriter {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

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
  }

  clear(response: CookieResponse, realm: AuthRealm): void {
    const names = realmCookies[realm];
    response.clearCookie(names.access, this.accessOptions());
    response.clearCookie(names.refresh, this.refreshOptions(names));
  }

  private accessOptions(): Omit<CookieOptions, "maxAge"> {
    return { httpOnly: true, secure: true, sameSite: "lax", path: "/" };
  }

  private refreshOptions(names: RealmCookies): Omit<CookieOptions, "maxAge"> {
    return { httpOnly: true, secure: true, sameSite: "strict", path: names.refreshPath };
  }
}
