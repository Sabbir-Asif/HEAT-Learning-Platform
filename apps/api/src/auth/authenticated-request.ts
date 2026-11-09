import type { CookieHeader } from "./cookie-reader";
import type { AuthenticatedSession } from "./auth.types";

export interface AuthenticatedRequest {
  headers: { cookie?: CookieHeader; "user-agent"?: string };
  ip?: string;
  authSession?: AuthenticatedSession;
}
