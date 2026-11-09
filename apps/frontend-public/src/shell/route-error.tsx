"use client";

import { PageError } from "@heat/ui/shell";

export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  return <PageError onRetry={reset} />;
}
