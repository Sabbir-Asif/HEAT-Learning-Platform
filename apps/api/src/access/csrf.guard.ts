import { csrfHeaderName } from "@heat/contracts";
import { Inject, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CsrfTokenService, readCookie, realmCsrfCookies } from "../auth";
import type { AuthenticatedRequest } from "../auth";
import { APP_CONFIG } from "../core";
import type { AppConfig } from "../core";
import { ApiException } from "../http/api-exception";
import { resolveAccessPolicy } from "./access-policy";
import { constantTimeEqual } from "./constant-time-equal";

interface CsrfRequest extends AuthenticatedRequest {
  method: string;
  headers: AuthenticatedRequest["headers"] & Record<string, string | string[] | undefined>;
}

const safeMethods: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"]);
const acceptedFetchSites: ReadonlySet<string> = new Set(["same-origin", "same-site", "none"]);
const originlessFetchSites: ReadonlySet<string> = new Set(["same-origin", "none"]);

const single = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly trustedOrigins: ReadonlySet<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: CsrfTokenService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.trustedOrigins = new Set(config.csrf.trustedOrigins);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<CsrfRequest>();
    if (safeMethods.has(request.method.toUpperCase())) return true;
    this.assertOrigin(request);
    const policy = resolveAccessPolicy(this.reflector, [context.getHandler(), context.getClass()]);
    if (policy.kind !== "protected") return true;
    this.assertToken(request);
    return true;
  }

  private assertOrigin(request: CsrfRequest): void {
    const origin = request.headers.origin;
    const fetchSite = single(request.headers["sec-fetch-site"]);
    if (origin !== undefined) {
      if (typeof origin !== "string" || !this.trustedOrigins.has(origin)) {
        throw new ApiException(403, "ORIGIN_NOT_ALLOWED");
      }
      if (fetchSite !== undefined && !acceptedFetchSites.has(fetchSite)) {
        throw new ApiException(403, "ORIGIN_NOT_ALLOWED");
      }
      return;
    }
    if (fetchSite !== undefined && !originlessFetchSites.has(fetchSite)) {
      throw new ApiException(403, "ORIGIN_NOT_ALLOWED");
    }
  }

  private assertToken(request: CsrfRequest): void {
    const session = request.authSession;
    const header = single(request.headers[csrfHeaderName]);
    const cookie =
      session === undefined
        ? undefined
        : readCookie(request.headers.cookie, realmCsrfCookies[session.realm]);
    if (
      session === undefined ||
      header === undefined ||
      cookie === undefined ||
      !constantTimeEqual(header, cookie) ||
      !this.tokens.verify(session.realm, session.familyId, header)
    ) {
      throw new ApiException(403, "CSRF_TOKEN_INVALID");
    }
  }
}
