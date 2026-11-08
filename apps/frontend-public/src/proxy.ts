import { LOCALE_COOKIE, negotiateLocale } from "@heat/i18n";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") return NextResponse.next();
  const locale = negotiateLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const target = new URL(request.url);
  target.pathname = `/${locale}`;
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Accept-Language, Cookie");
  return response;
}

export const config = { matcher: ["/"] };
