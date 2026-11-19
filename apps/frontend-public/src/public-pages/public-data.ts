import "server-only";
import { isApiError } from "@heat/api-client";
import {
  publicCoursesGet,
  publicFrontPageGet,
  publicSiteSettingsGet,
} from "@heat/api-client/server";
import { courseCacheTag, frontPageCacheTag, landingCacheTag } from "@heat/contracts";
import type {
  PublicCourseResponse,
  PublicFrontPageResponse,
  PublicLandingOverviewResponse,
} from "@heat/contracts";
import { cacheLife, cacheTag } from "next/cache";

export async function cachedLandingOverview(): Promise<PublicLandingOverviewResponse> {
  "use cache";
  cacheTag(landingCacheTag);
  cacheLife("hours");
  return publicSiteSettingsGet({ forwardCookies: false });
}

export async function cachedFrontPage(): Promise<PublicFrontPageResponse> {
  "use cache";
  cacheTag(frontPageCacheTag);
  cacheLife("hours");
  return publicFrontPageGet({ forwardCookies: false });
}

export async function cachedCourse(slug: string): Promise<PublicCourseResponse | null> {
  "use cache";
  cacheTag(courseCacheTag(slug));
  cacheLife("hours");
  try {
    return await publicCoursesGet(slug, { forwardCookies: false });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
