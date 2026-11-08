import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";

const MAX_HEADER_LENGTH = 1024;
const MAX_ENTRIES = 32;

export interface NegotiationInput {
  cookie?: string | null;
  acceptLanguage?: string | null;
}

function isDigits(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  return true;
}

function parseQuality(value: string): number | null {
  const whole = value[0];
  if (whole !== "0" && whole !== "1") return null;
  if (value.length === 1) return Number(whole);
  if (value[1] !== ".") return null;
  const fraction = value.slice(2);
  if (fraction.length < 1 || fraction.length > 3 || !isDigits(fraction)) return null;
  const quality = Number(value);
  return quality > 1 ? null : quality;
}

function qualityOf(parameters: string[]): number | null {
  for (const raw of parameters) {
    const parameter = raw.trim();
    if ((parameter[0] === "q" || parameter[0] === "Q") && parameter[1] === "=") {
      return parseQuality(parameter.slice(2));
    }
  }
  return 1;
}

function fromAcceptLanguage(header: string): Locale | null {
  let best: Locale | null = null;
  let bestQuality = 0;
  for (const entry of header.slice(0, MAX_HEADER_LENGTH).split(",", MAX_ENTRIES)) {
    const [tag = "", ...parameters] = entry.split(";");
    const primary = tag.trim().toLowerCase().split("-", 1)[0];
    if (!isLocale(primary)) continue;
    const quality = qualityOf(parameters);
    if (quality === null || quality <= bestQuality) continue;
    best = primary;
    bestQuality = quality;
  }
  return best;
}

export function negotiateLocale({ cookie, acceptLanguage }: NegotiationInput): Locale {
  if (isLocale(cookie)) return cookie;
  return (acceptLanguage ? fromAcceptLanguage(acceptLanguage) : null) ?? DEFAULT_LOCALE;
}
