import { HydrationBoundary } from "@tanstack/react-query";
import { CertificatesScreen } from "@/certificates/certificates-screen";
import { loadCertificatesPage } from "@/certificates/certificates-page-data";

export default async function Page() {
  const state = await loadCertificatesPage();
  return (
    <HydrationBoundary state={state}>
      <CertificatesScreen />
    </HydrationBoundary>
  );
}
