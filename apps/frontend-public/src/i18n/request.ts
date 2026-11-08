import { LOCALES, TIME_ZONE, messages } from "@heat/i18n";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { getMessageFallback, onError } from "./handlers";

export default getRequestConfig(async () => {
  const requested = await rootLocale();
  if (!hasLocale(LOCALES, requested)) notFound();
  return {
    locale: requested,
    messages: messages[requested],
    timeZone: TIME_ZONE,
    onError,
    getMessageFallback,
  };
});
