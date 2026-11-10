"use client";

import { useAdminInvitationLookup } from "@heat/api-client";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@heat/ui";
import { MailXIcon, TimerOffIcon } from "lucide-react";
import { useState } from "react";
import { AcceptInviteForm } from "./accept-invite-form";
import { invitationExpiredMessage, invitationInvalidMessage } from "./admin-copy";

export function AcceptInvite({ token }: { token: string }) {
  const lookup = useAdminInvitationLookup(token);
  const [unusable, setUnusable] = useState<"expired" | "invalid" | null>(null);

  if (lookup.isPending) {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Checking your invitation</span>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (lookup.isError) return <ErrorState onRetry={() => void lookup.refetch()} />;

  const state =
    unusable ??
    (lookup.data.status === "VALID"
      ? null
      : lookup.data.status === "EXPIRED"
        ? "expired"
        : "invalid");
  if (state === "expired") {
    return (
      <EmptyState
        icon={TimerOffIcon}
        title="Invitation expired"
        description={invitationExpiredMessage}
      />
    );
  }
  if (state === "invalid") {
    return (
      <EmptyState
        icon={MailXIcon}
        title="Invitation not valid"
        description={invitationInvalidMessage}
      />
    );
  }
  return (
    <>
      <PageHeader title="Accept invitation" />
      <AcceptInviteForm token={token} email={lookup.data.email ?? ""} onUnusable={setUnusable} />
    </>
  );
}
