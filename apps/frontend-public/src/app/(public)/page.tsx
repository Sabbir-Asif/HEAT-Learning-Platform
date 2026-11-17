import { LandingPage } from "@/public-pages/landing-page";
import { cachedFrontPage, cachedLandingOverview } from "@/public-pages/public-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [overview, frontPage] = await Promise.all([cachedLandingOverview(), cachedFrontPage()]);
  return <LandingPage overview={overview} frontPage={frontPage} />;
}
