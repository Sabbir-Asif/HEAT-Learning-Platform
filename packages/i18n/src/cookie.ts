import { isLocale, LOCALE_COOKIE, type Locale } from "./locale";

const ONE_YEAR_IN_SECONDS = 31_536_000;

export function serializeLocaleCookie(locale: Locale): string {
  if (!isLocale(locale)) throw new TypeError("Unsupported locale");
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax; Secure`;
}
