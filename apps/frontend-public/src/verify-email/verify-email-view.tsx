"use client";

import { useVerificationConfirm } from "@heat/api-client";
import { Button, ErrorState, FieldDescription, PageHeader, Skeleton } from "@heat/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ResendVerificationForm } from "../awaiting/resend-verification-form";
import { classifyVerificationFailure } from "./verification-failure";

export interface VerifyEmailViewProps {
  token: string;
}

function SignInLink() {
  return (
    <div>
      <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
        Sign in
      </Button>
    </div>
  );
}

export function VerifyEmailView({ token }: VerifyEmailViewProps) {
  const router = useRouter();
  const confirm = useVerificationConfirm();
  const { mutate } = confirm;
  const started = useRef(false);

  const run = useCallback(() => {
    mutate({ data: { token } }, { onSuccess: () => router.replace("/awaiting-approval") });
  }, [mutate, router, token]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  if (confirm.isSuccess) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <PageHeader title="Email verified" />
        <FieldDescription>Taking you to your enrollment request.</FieldDescription>
      </div>
    );
  }

  if (confirm.isError) {
    const failure = classifyVerificationFailure(confirm.error);
    if (failure.kind === "used") {
      return (
        <div className="flex flex-col gap-3">
          <PageHeader title="This link was already used" />
          <FieldDescription>
            This verification link was already used or has been replaced by a newer one. Sign in to
            continue.
          </FieldDescription>
          <SignInLink />
        </div>
      );
    }
    if (failure.kind === "expired") {
      return (
        <div className="flex flex-col gap-3">
          <PageHeader title="This link has expired" />
          <FieldDescription>Request a new verification link to continue.</FieldDescription>
          <ResendVerificationForm />
        </div>
      );
    }
    if (failure.kind === "invalid") {
      return (
        <div className="flex flex-col gap-3">
          <PageHeader title="This link is not valid" />
          <FieldDescription>
            Check that you opened the full link from your email, or sign in to request a new one.
          </FieldDescription>
          <SignInLink />
        </div>
      );
    }
    return (
      <ErrorState
        title="We could not verify your email"
        description={failure.message}
        onRetry={run}
      />
    );
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Verifying your email address</span>
      <PageHeader title="Verifying your email" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}
