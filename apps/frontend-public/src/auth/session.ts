import "server-only";
import { ApiError } from "@heat/api-client";
import { meDescribe } from "@heat/api-client/server";
import { grantsCourseAccess } from "@heat/contracts";
import type { MeEnrollment, MeResponse } from "@heat/contracts";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { safeNextPath } from "./next-path";
import { pathnameHeader } from "./session-gate";

async function refreshLocation(): Promise<string> {
  const current = (await headers()).get(pathnameHeader);
  const next = safeNextPath(current);
  return `/auth/refresh?next=${encodeURIComponent(next)}`;
}

export const verifySession = cache(async (): Promise<MeResponse> => {
  try {
    return await meDescribe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(await refreshLocation());
    throw error;
  }
});

export interface CourseAccess {
  session: MeResponse;
  enrollment: MeEnrollment;
}

export async function requireCourseAccess(courseSlug: string): Promise<CourseAccess> {
  const session = await verifySession();
  const enrollment = session.enrollments.find(
    (candidate) => candidate.courseSlug === courseSlug && grantsCourseAccess(candidate.status),
  );
  if (enrollment === undefined) redirect(`/courses/${encodeURIComponent(courseSlug)}`);
  return { session, enrollment };
}
