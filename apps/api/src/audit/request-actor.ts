import type { AuthenticatedRequest } from "../auth";
import type { AuditActor } from "./audit.types";

const requestIdPattern = /^[A-Za-z0-9._-]{1,64}$/;

export interface AuditableRequest extends AuthenticatedRequest {
  headers: AuthenticatedRequest["headers"] & { "x-request-id"?: string | string[] };
}

export const actorOf = (request: AuditableRequest, actorId?: string | null): AuditActor => {
  const header = request.headers["x-request-id"];
  return {
    actorId: actorId ?? request.authSession?.userId ?? null,
    ipAddress: request.ip,
    requestId: typeof header === "string" && requestIdPattern.test(header) ? header : undefined,
  };
};
