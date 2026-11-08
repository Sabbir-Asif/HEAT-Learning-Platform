import type { IntlError } from "next-intl";

export function onError(error: IntlError): void {
  console.error(JSON.stringify({ event: "i18n.error", code: error.code, message: error.message }));
}

export function getMessageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
  error: IntlError;
}): string {
  return namespace ? `${namespace}.${key}` : key;
}
