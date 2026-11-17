import { ContactPage } from "@/public-pages/contact-page";
import { cachedContactSettings } from "@/public-pages/public-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the HEAT project team at the University of Dhaka.",
};

export default async function Page() {
  const settings = await cachedContactSettings();
  return <ContactPage settings={settings} />;
}
