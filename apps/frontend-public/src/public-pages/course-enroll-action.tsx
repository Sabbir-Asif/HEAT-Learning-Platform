"use client";

import { getMeDescribeQueryKey, isApiError, useSignedInEnrollmentRequest } from "@heat/api-client";
import { grantsCourseAccess } from "@heat/contracts";
import type { MeResponse } from "@heat/contracts";
import { Button, FieldDescription, FieldError, StatusBadge, formErrorCopy } from "@heat/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useStudentSession } from "../auth/use-student-session";
import { EnrollButton } from "./enroll-button";

interface CourseEnrollActionProps {
  courseSlug: string;
  courseTitle: string;
}

export const requestFailureMessage = (error: unknown): string => {
  if (isApiError(error) && error.code in formErrorCopy) {
    return formErrorCopy[error.code as keyof typeof formErrorCopy];
  }
  return "The request could not be sent. Try again.";
};

function SignedInAction({
  session,
  courseSlug,
  courseTitle,
}: CourseEnrollActionProps & { session: MeResponse }) {
  const queryClient = useQueryClient();
  const { mutate, isPending, error } = useSignedInEnrollmentRequest();
  const enrollment = session.enrollments.find((candidate) => candidate.courseSlug === courseSlug);

  if (enrollment !== undefined) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge kind="enrollment" status={enrollment.status} />
        {grantsCourseAccess(enrollment.status) ? (
          <Button nativeButton={false} render={<Link href={`/learn/${courseSlug}`} />}>
            Continue learning
            <span className="sr-only"> {courseTitle}</span>
          </Button>
        ) : null}
      </div>
    );
  }

  if (!session.user.emailVerified) {
    return <FieldDescription>Verify your email address to request this course.</FieldDescription>;
  }

  function request() {
    mutate(
      { data: { courseSlug } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getMeDescribeQueryKey() }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button onClick={request} disabled={isPending}>
          Request to enroll
          <span className="sr-only"> in {courseTitle}</span>
        </Button>
      </div>
      {error === null ? null : <FieldError>{requestFailureMessage(error)}</FieldError>}
    </div>
  );
}

export function CourseEnrollAction({ courseSlug, courseTitle }: CourseEnrollActionProps) {
  const state = useStudentSession();
  if (state.kind !== "signed-in") {
    return <EnrollButton courseSlug={courseSlug} courseTitle={courseTitle} />;
  }
  return (
    <SignedInAction session={state.session} courseSlug={courseSlug} courseTitle={courseTitle} />
  );
}
