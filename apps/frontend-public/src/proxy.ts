import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { accessCookieName, decideGate, pathnameHeader } from "./auth/session-gate";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = decideGate({
    pathname,
    search,
    accessToken: request.cookies.get(accessCookieName)?.value,
    nowMs: Date.now(),
  });
  if (decision.kind === "refresh") {
    return NextResponse.redirect(new URL(decision.location, request.url));
  }
  const headers = new Headers(request.headers);
  headers.set(pathnameHeader, `${pathname}${search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/(dashboard|learn|certificates|notifications|profile|awaiting-approval)/:path*"],
};
