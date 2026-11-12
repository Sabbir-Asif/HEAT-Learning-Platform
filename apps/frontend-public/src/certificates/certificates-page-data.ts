import "server-only";
import { getMeCertificatesListUrl, meCertificatesList } from "@heat/api-client/server";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { verifySession } from "../auth/session";

export async function loadCertificatesPage(): Promise<DehydratedState> {
  await verifySession();
  const certificates = await meCertificatesList();
  const client = new QueryClient();
  client.setQueryData([getMeCertificatesListUrl()], certificates);
  return dehydrate(client);
}
