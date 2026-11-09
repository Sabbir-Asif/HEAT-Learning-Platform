import { createParamDecorator, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthenticatedSession } from "./auth.types";
import type { AuthenticatedRequest } from "./authenticated-request";

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const session = context.switchToHttp().getRequest<AuthenticatedRequest>().authSession;
    if (session === undefined) throw new UnauthorizedException();
    return session;
  },
);
