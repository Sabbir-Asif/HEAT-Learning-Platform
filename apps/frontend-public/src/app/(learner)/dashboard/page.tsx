import { HydrationBoundary } from "@tanstack/react-query";
import { DashboardScreen } from "@/dashboard/dashboard-screen";
import { loadDashboardPage } from "@/dashboard/dashboard-page-data";

export default async function Page() {
  const state = await loadDashboardPage();
  return (
    <HydrationBoundary state={state}>
      <DashboardScreen />
    </HydrationBoundary>
  );
}
