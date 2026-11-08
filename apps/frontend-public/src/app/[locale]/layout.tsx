import { LOCALES } from "@heat/i18n";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LocaleSwitchControl } from "../../components/locale-switch-control";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return { title: t("title") };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const t = await getTranslations("site.localeSwitch");
  return (
    <html lang={locale} dir="ltr">
      <body>
        <LocaleSwitchControl label={t("label")} current={locale} />
        {children}
      </body>
    </html>
  );
}
