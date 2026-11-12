import "server-only";
import { dashboardDescribe, getDashboardDescribeUrl } from "@heat/api-client/server";
import { QueryClient, dehydrate } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { verifySession } from "../auth/session";
import { dashboardRedirectPath } from "./dashboard-view";

export async function loadDashboardPage(): Promise<DehydratedState> {
  await verifySession();
  const dashboard = await dashboardDescribe();
  const target = dashboardRedirectPath(dashboard.courses);
  if (target !== null) redirect(target);
  const client = new QueryClient();
  client.setQueryData([getDashboardDescribeUrl()], dashboard);
  return dehydrate(client);
}
