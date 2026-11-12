import "server-only";
import { getProfileDescribeUrl, profileDescribe } from "@heat/api-client/server";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { verifySession } from "../auth/session";

export async function loadProfilePage(): Promise<DehydratedState> {
  await verifySession();
  const profile = await profileDescribe();
  const client = new QueryClient();
  client.setQueryData([getProfileDescribeUrl()], profile);
  return dehydrate(client);
}
