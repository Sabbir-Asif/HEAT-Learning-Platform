import { PageHeader } from "@heat/ui";
import { RefreshSession } from "@/auth/refresh-session";
import { safeNextPath } from "@/auth/next-path";

interface RefreshPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function Page({ searchParams }: RefreshPageProps) {
  const { next } = await searchParams;
  const requested = Array.isArray(next) ? next[0] : next;
  return (
    <>
      <PageHeader title="Restoring your session" />
      <RefreshSession next={safeNextPath(requested)} />
    </>
  );
}
