"use client";

import { useProfileChangeLatest } from "@heat/api-client";
import type { ProfileChangeRequestDto, ProfileResponseDto } from "@heat/api-client";
import { Button, ErrorState, FieldDescription, FieldTitle, Skeleton } from "@heat/ui";
import { useState } from "react";
import type { ReactNode } from "react";
import { ChangeRequestForm } from "./change-request-form";
import { changeRequestState, requestedLines } from "./change-request-view";
import {
  changeRequestHeading,
  changeRequestIntro,
  changeRequestPendingMessage,
  changeRequestRejectedMessage,
} from "./profile-copy";

interface ChangeRequestSectionProps {
  profile: ProfileResponseDto;
}

function SectionFrame({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="profile-change-request" className="flex flex-col gap-3">
      <FieldTitle id="profile-change-request" className="sr-only">
        {changeRequestHeading}
      </FieldTitle>
      {children}
    </section>
  );
}

function PendingRequest({ request }: { request: ProfileChangeRequestDto }) {
  return (
    <>
      <FieldDescription role="status">{changeRequestPendingMessage}</FieldDescription>
      <ul className="flex flex-col gap-1">
        {requestedLines(request.requested).map((line) => (
          <li key={line}>
            <FieldDescription>{line}</FieldDescription>
          </li>
        ))}
      </ul>
      {request.note !== null ? <FieldDescription>Note: {request.note}</FieldDescription> : null}
    </>
  );
}

function RejectedNotice({ request }: { request: ProfileChangeRequestDto }) {
  return (
    <div role="status" className="flex flex-col gap-1">
      <FieldDescription>{changeRequestRejectedMessage}</FieldDescription>
      {request.reason !== null ? (
        <FieldDescription>Reason: {request.reason}</FieldDescription>
      ) : null}
    </div>
  );
}

export function ChangeRequestSection({ profile }: ChangeRequestSectionProps) {
  const latest = useProfileChangeLatest();
  const [open, setOpen] = useState(false);
  if (latest.isPending) {
    return (
      <SectionFrame>
        <div aria-busy="true">
          <p role="status" className="sr-only">
            Loading
          </p>
          <Skeleton className="h-32" />
        </div>
      </SectionFrame>
    );
  }
  if (latest.isError) {
    return (
      <SectionFrame>
        <ErrorState onRetry={() => void latest.refetch()} />
      </SectionFrame>
    );
  }
  const request = latest.data.request;
  const state = changeRequestState(request);
  if (request !== null && state === "pending") {
    return (
      <SectionFrame>
        <PendingRequest request={request} />
      </SectionFrame>
    );
  }
  return (
    <SectionFrame>
      {request !== null && state === "rejected" ? <RejectedNotice request={request} /> : null}
      <FieldDescription>{changeRequestIntro}</FieldDescription>
      {open ? (
        <>
          <ChangeRequestForm
            key={`${profile.name}-${profile.session}-${profile.department.id}`}
            profile={profile}
          />
          <div>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Request a change
          </Button>
        </div>
      )}
    </SectionFrame>
  );
}
