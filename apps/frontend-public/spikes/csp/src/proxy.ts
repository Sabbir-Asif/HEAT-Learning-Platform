import { NextResponse, type NextRequest } from "next/server";
import { buildPolicy, newNonce, THEME_SCRIPT_HASH } from "./policy";

export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const policy = buildPolicy({
    nonce,
    development: process.env.NODE_ENV === "development",
    scriptHashes: [THEME_SCRIPT_HASH],
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const header =
    process.env.SPIKE_ENFORCE === "1"
      ? "content-security-policy"
      : "content-security-policy-report-only";
  response.headers.set(header, policy);
  return response;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
