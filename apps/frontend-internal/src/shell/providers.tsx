"use client";

import { installCsrf, installSessionRefresh } from "@heat/api-client";
import { adminCsrf, adminSessionCookies } from "@heat/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { signInLocation } from "../auth/sign-in-location";

export const adminSessionRefreshOptions = {
  refreshPath: adminSessionCookies.refreshPath,
  skipPaths: ["/api/admin/auth/sign-in", adminSessionCookies.refreshPath],
};

export const adminCsrfOptions = {
  cookieName: adminCsrf.cookie,
  tokenPath: adminCsrf.tokenPath,
  skipPaths: ["/api/admin/auth/sign-in", adminSessionCookies.refreshPath],
};

function createBrowserQueryClient(): QueryClient {
  if (typeof window !== "undefined") {
    installCsrf(adminCsrfOptions);
    installSessionRefresh({
      ...adminSessionRefreshOptions,
      onExpired: () => {
        const { pathname, search } = window.location;
        if (pathname === "/sign-in" || pathname === "/auth/refresh") return;
        window.location.assign(signInLocation(`${pathname}${search}`));
      },
    });
  }
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(createBrowserQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
