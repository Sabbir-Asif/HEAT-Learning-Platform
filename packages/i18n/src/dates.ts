import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { bn } from "date-fns/locale/bn";
import { enUS } from "date-fns/locale/en-US";
import type { Locale } from "./locale";

export const TIME_ZONE = "Asia/Dhaka";

export type DateInput = Date | string | number;

const dateLocales = { bn, en: enUS };
const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function toDate(input: DateInput): Date {
  if (typeof input === "string" && !ISO_WITH_OFFSET.test(input)) {
    throw new RangeError("A date string needs a time and an offset or Z");
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date");
  return date;
}

function render(input: DateInput, locale: Locale, pattern: string): string {
  const text = format(toDate(input), pattern, { in: tz(TIME_ZONE), locale: dateLocales[locale] });
  return locale === "bn"
    ? text.replace(/[0-9]/g, (digit) => bengaliDigits[Number(digit)] ?? digit)
    : text;
}

export const formatDate = (input: DateInput, locale: Locale) =>
  render(input, locale, "d MMMM yyyy");

export const formatTime = (input: DateInput, locale: Locale) => render(input, locale, "HH:mm");

export const formatDateTime = (input: DateInput, locale: Locale) =>
  render(input, locale, "d MMMM yyyy, HH:mm");
