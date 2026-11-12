import { ContactPage } from "@/public-pages/contact-page";
import { cachedContactSettings } from "@/public-pages/public-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Contact" };

export default async function Page() {
  const settings = await cachedContactSettings();
  return <ContactPage settings={settings} />;
}
