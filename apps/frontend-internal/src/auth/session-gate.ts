import { adminSessionCookies } from "@heat/contracts";

export const accessCookieName = adminSessionCookies.access;
export const refreshLeewaySeconds = 60;
export const pathnameHeader = "x-pathname";

export const openPrefixes = [
  "/sign-in",
  "/auth/refresh",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
] as const;

export const isProtectedPath = (pathname: string): boolean =>
  !openPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function accessExpiry(token: string | undefined): number | undefined {
  if (token === undefined) return undefined;
  const payload = token.split(".")[1];
  if (payload === undefined) return undefined;
  try {
    const padded = payload.replaceAll("-", "+").replaceAll("_", "/");
    const decoded: unknown = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "=")));
    if (typeof decoded !== "object" || decoded === null || !("exp" in decoded)) return undefined;
    return typeof decoded.exp === "number" ? decoded.exp : undefined;
  } catch {
    return undefined;
  }
}

export const needsRefresh = (token: string | undefined, nowMs: number): boolean => {
  const expiry = accessExpiry(token);
  return expiry === undefined || expiry * 1000 - nowMs <= refreshLeewaySeconds * 1000;
};

export type GateDecision = { kind: "pass" } | { kind: "refresh"; location: string };

export interface GateInput {
  pathname: string;
  search: string;
  accessToken: string | undefined;
  nowMs: number;
}

export function decideGate({ pathname, search, accessToken, nowMs }: GateInput): GateDecision {
  if (!isProtectedPath(pathname)) return { kind: "pass" };
  if (!needsRefresh(accessToken, nowMs)) return { kind: "pass" };
  return {
    kind: "refresh",
    location: `/auth/refresh?next=${encodeURIComponent(`${pathname}${search}`)}`,
  };
}
