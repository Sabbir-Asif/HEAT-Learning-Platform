import "server-only";
import { ApiError } from "@heat/api-client";
import { adminMeDescribe } from "@heat/api-client/server";
import type { AdminMeResponse } from "@heat/contracts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNextPath } from "./next-path";
import { pathnameHeader } from "./session-gate";
import { accountPath } from "./sign-in-location";

async function currentPath(): Promise<string> {
  return (await headers()).get(pathnameHeader) ?? "/";
}

export const verifySession = cache(async (): Promise<AdminMeResponse> => {
  try {
    return await adminMeDescribe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const next = safeNextPath(await currentPath());
      redirect(`/auth/refresh?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
});

export async function verifyReadySession(): Promise<AdminMeResponse> {
  const session = await verifySession();
  if (session.user.mustChangePassword) {
    const pathname = (await currentPath()).split("?")[0];
    if (pathname !== accountPath) redirect(accountPath);
  }
  return session;
}
