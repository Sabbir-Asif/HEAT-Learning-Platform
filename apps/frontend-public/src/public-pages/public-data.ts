import "server-only";
import { isApiError } from "@heat/api-client";
import {
  publicContactSettingsGet,
  publicCoursesGet,
  publicFrontPageGet,
  publicNewsGet,
  publicNewsList,
  publicSiteSettingsGet,
} from "@heat/api-client/server";
import {
  contactCacheTag,
  courseCacheTag,
  frontPageCacheTag,
  landingCacheTag,
  newsListCacheTag,
  newsPostCacheTag,
} from "@heat/contracts";
import type {
  NewsPublicListResponse,
  NewsPublicPost,
  PublicCourseResponse,
  PublicFrontPageResponse,
  PublicContactSettingsResponse,
  PublicLandingOverviewResponse,
} from "@heat/contracts";
import { cacheLife, cacheTag } from "next/cache";

export async function cachedLandingOverview(): Promise<PublicLandingOverviewResponse> {
  "use cache";
  cacheTag(landingCacheTag);
  cacheLife("hours");
  return publicSiteSettingsGet({ forwardCookies: false });
}

export async function cachedContactSettings(): Promise<PublicContactSettingsResponse> {
  "use cache";
  cacheTag(contactCacheTag);
  cacheLife("hours");
  return publicContactSettingsGet({ forwardCookies: false });
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

export async function cachedNewsList(page: number): Promise<NewsPublicListResponse> {
  "use cache";
  cacheTag(newsListCacheTag);
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  return publicNewsList({ page }, { forwardCookies: false });
}

export async function cachedNewsPost(slug: string): Promise<NewsPublicPost | null> {
  "use cache";
  cacheTag(newsPostCacheTag(slug), newsListCacheTag);
  cacheLife({ stale: 30, revalidate: 60, expire: 3600 });
  try {
    return await publicNewsGet(slug, { forwardCookies: false });
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}
