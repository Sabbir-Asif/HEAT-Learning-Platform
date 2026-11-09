import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./authenticated-request";
import { realmCookies } from "./cookie-writer";
import { readCookie } from "./cookie-reader";
import { IS_PUBLIC } from "./public.decorator";
import { SessionService } from "./session.service";

@Injectable()
export class StudentAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request.headers.cookie, realmCookies.student.access);
    if (token === undefined) throw new UnauthorizedException();
    request.authSession = await this.sessions.authenticate(token, "student");
    return true;
  }
}
