import { serializeLocaleCookie, switchLocalePath, type Locale } from "@heat/i18n";

export interface ChangeLocaleInput {
  target: Locale;
  pathname: string;
  search: string;
  hash: string;
  writeCookie: (cookie: string) => void;
  navigate: (url: string) => void;
}

export function changeLocale({
  target,
  pathname,
  search,
  hash,
  writeCookie,
  navigate,
}: ChangeLocaleInput): void {
  writeCookie(serializeLocaleCookie(target));
  navigate(switchLocalePath(`${pathname}${search}${hash}`, target));
}
