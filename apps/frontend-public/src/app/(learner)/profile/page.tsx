import { HydrationBoundary } from "@tanstack/react-query";
import { loadProfilePage } from "@/profile/profile-page-data";
import { ProfileScreen } from "@/profile/profile-screen";

export default async function Page() {
  const state = await loadProfilePage();
  return (
    <HydrationBoundary state={state}>
      <ProfileScreen />
    </HydrationBoundary>
  );
}
