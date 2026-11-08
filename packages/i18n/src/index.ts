import { bn } from "./messages/bn";
import { en } from "./messages/en";

export const packageName = "@heat/i18n";

export { compareKeys, flattenKeys } from "./keys";
export type { Catalog } from "./keys";
export { checkParity } from "./parity";
export type { ParityReport } from "./parity";
export { placeholderNames } from "./placeholders";
export { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_NAMES, LOCALES, isLocale } from "./locale";
export type { Locale } from "./locale";
export { negotiateLocale } from "./negotiate";
export type { NegotiationInput } from "./negotiate";
export { switchLocalePath } from "./switch-locale-path";
export { serializeLocaleCookie } from "./cookie";

export { TIME_ZONE, formatDate, formatDateTime, formatTime } from "./dates";
export type { DateInput } from "./dates";

export const messages = { en, bn };
export type Messages = typeof en;
