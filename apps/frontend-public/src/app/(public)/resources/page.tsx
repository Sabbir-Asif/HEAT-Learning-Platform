import { ResourcesList } from "@/public-pages/resources-list";
import { cachedResources } from "@/public-pages/public-data";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Resources" };

export default async function Page() {
  const resources = await cachedResources();
  return <ResourcesList resources={resources} />;
}
