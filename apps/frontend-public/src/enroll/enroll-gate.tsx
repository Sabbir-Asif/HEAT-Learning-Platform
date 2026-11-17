"use client";

import { Skeleton } from "@heat/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStudentSession } from "../auth/use-student-session";
import { courseHref } from "../public-pages/links";
import { EnrollWizard } from "./enroll-wizard";

export function EnrollGate({ courseSlug }: { courseSlug: string }) {
  const state = useStudentSession();
  const router = useRouter();
  const signedIn = state.kind === "signed-in";

  useEffect(() => {
    if (signedIn) router.replace(courseHref(courseSlug));
  }, [signedIn, router, courseSlug]);

  if (state.kind === "anonymous") return <EnrollWizard courseSlug={courseSlug} />;
  return <Skeleton className="h-64 w-full" role="status" aria-label="Loading" />;
}
