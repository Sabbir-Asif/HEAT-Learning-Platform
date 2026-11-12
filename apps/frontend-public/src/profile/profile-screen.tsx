"use client";

import { useProfileDescribe } from "@heat/api-client";
import { ErrorState, FieldDescription, FieldTitle, PageHeader, Skeleton } from "@heat/ui";
import { ShellContent } from "@heat/ui/shell";
import { SignOutButton } from "../auth/sign-out-button";
import { ResendVerificationForm } from "../awaiting/resend-verification-form";
import { AvatarSection } from "./avatar-section";
import { DetailsForm } from "./details-form";
import { PasswordSection } from "./password-section";

export function ProfileScreen() {
  const profile = useProfileDescribe();
  if (profile.isPending) {
    return (
      <ShellContent aria-busy="true">
        <p role="status" className="sr-only">
          Loading
        </p>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-24" />
        <Skeleton className="h-64" />
      </ShellContent>
    );
  }
  if (profile.isError) {
    return (
      <ShellContent>
        <PageHeader title="Profile" />
        <ErrorState onRetry={() => void profile.refetch()} />
      </ShellContent>
    );
  }
  const data = profile.data;
  return (
    <ShellContent>
      <PageHeader title="Profile" action={<SignOutButton />} />
      <AvatarSection profile={data} />
      <DetailsForm key={`${data.name}-${data.session}-${data.department.id}`} profile={data} />
      <section aria-labelledby="profile-email" className="flex flex-col gap-3">
        <FieldTitle id="profile-email">Email</FieldTitle>
        <FieldDescription>{data.email}</FieldDescription>
        {data.emailVerified ? (
          <FieldDescription>Your email address is verified.</FieldDescription>
        ) : (
          <>
            <FieldDescription>Your email address is not verified yet.</FieldDescription>
            <ResendVerificationForm defaultEmail={data.email} />
          </>
        )}
      </section>
      <PasswordSection emailVerified={data.emailVerified} />
    </ShellContent>
  );
}
