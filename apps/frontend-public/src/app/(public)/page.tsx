import { LandingPage } from "@/public-pages/landing-page";
import { cachedFrontPage } from "@/public-pages/public-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const frontPage = await cachedFrontPage();
  return <LandingPage frontPage={frontPage} />;
}
