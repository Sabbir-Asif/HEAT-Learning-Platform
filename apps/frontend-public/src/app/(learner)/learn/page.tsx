import { HydrationBoundary } from "@tanstack/react-query";
import { loadDashboardPage } from "@/dashboard/dashboard-page-data";
import { MyLearningScreen } from "@/dashboard/my-learning-screen";

export default async function Page() {
  const state = await loadDashboardPage();
  return (
    <HydrationBoundary state={state}>
      <MyLearningScreen />
    </HydrationBoundary>
  );
}
