"use client";

import { installSessionRefresh } from "@heat/api-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { signInLocation } from "../auth/sign-in-location";

function createBrowserQueryClient(): QueryClient {
  if (typeof window !== "undefined") {
    installSessionRefresh({
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
