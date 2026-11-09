import { ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiException } from "../http/api-exception";
import { SessionService, readCookie, realmCookies } from "../auth";
import type { AuthRealm, AuthenticatedRequest } from "../auth";
import { resolveAccessPolicy } from "./access-policy";
import { EnrollmentAccessService } from "./enrollment-access.service";

interface AccessRequest extends AuthenticatedRequest {
  params?: Record<string, string | string[] | undefined>;
}

const otherRealm = (realm: AuthRealm): AuthRealm => (realm === "admin" ? "student" : "admin");

@Injectable()
export class AccessGuard implements CanActivate {
  private readonly logger = new Logger(AccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly enrollments: EnrollmentAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = resolveAccessPolicy(this.reflector, [context.getHandler(), context.getClass()]);
    if (policy.kind === "public") return true;
    if (policy.kind === "denied") {
      this.logger.error(
        `${context.getClass().name}.${context.getHandler().name}: ${policy.reason}`,
      );
      throw new ForbiddenException();
    }
    const request = context.switchToHttp().getRequest<AccessRequest>();
    const token = readCookie(request.headers.cookie, realmCookies[policy.audience].access);
    if (token === undefined) return this.rejectMissing(request, policy.audience);
    const session = await this.sessions.authenticate(token, policy.audience);
    if (!policy.roles.includes(session.role)) throw new ForbiddenException();
    if (policy.courseParam !== undefined) {
      const raw = request.params?.[policy.courseParam];
      const courseId = typeof raw === "string" ? raw : "";
      if (!(await this.enrollments.hasActiveEnrollment(session.userId, courseId))) {
        throw new ApiException(403, "ENROLLMENT_NOT_ACTIVE");
      }
    }
    request.authSession = session;
    return true;
  }

  private async rejectMissing(request: AccessRequest, audience: AuthRealm): Promise<boolean> {
    const foreign = readCookie(request.headers.cookie, realmCookies[otherRealm(audience)].access);
    if (foreign !== undefined) {
      const valid = await this.sessions
        .authenticate(foreign, otherRealm(audience))
        .then(() => true)
        .catch(() => false);
      if (valid) throw new ForbiddenException();
    }
    throw new UnauthorizedException();
  }
}
