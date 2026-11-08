import { LOCALE_COOKIE, negotiateLocale } from "@heat/i18n";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();
  const locale = negotiateLocale({
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get("accept-language"),
  });
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: `/${locale}${search}`,
      "Cache-Control": "private, no-store",
      Vary: "Accept-Language, Cookie",
    },
  });
}

export const config = { matcher: ["/"] };
