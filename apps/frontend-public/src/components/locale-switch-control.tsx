"use client";

import { LOCALES, LOCALE_NAMES, switchLocalePath, type Locale } from "@heat/i18n";
import { LocaleSwitch } from "@heat/ui";
import { usePathname } from "next/navigation";
import { changeLocale } from "../i18n/change-locale";

export interface LocaleSwitchControlProps {
  label: string;
  current: Locale;
}

export function LocaleSwitchControl({ label, current }: LocaleSwitchControlProps) {
  const pathname = usePathname();
  const options = LOCALES.map((locale) => ({
    value: locale,
    label: LOCALE_NAMES[locale],
    href: switchLocalePath(pathname, locale),
  }));

  return (
    <LocaleSwitch
      label={label}
      current={current}
      options={options}
      onChange={(value) => {
        changeLocale({
          target: value,
          pathname,
          search: window.location.search,
          hash: window.location.hash,
          writeCookie: (cookie) => {
            document.cookie = cookie;
          },
          navigate: (url) => window.location.assign(url),
        });
      }}
    />
  );
}
