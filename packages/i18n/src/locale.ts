export const LOCALES = ["bn", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "bn";

export const LOCALE_NAMES: Record<Locale, string> = { bn: "বাংলা", en: "English" };

export const LOCALE_COOKIE = "__Host-locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
