import { z } from "zod";
import { courseSlugPattern } from "./courses";
import { newsListCacheTag, newsPostTagPattern } from "./news";
import { resourcesCacheTag } from "./resources";

export const frontPageCacheTag = "front-page";
export const landingCacheTag = "landing";
export const contactCacheTag = "contact";
export const courseCacheTag = (slug: string): string => `course:${slug}`;

export const revalidateSecretHeader = "x-revalidate-secret";
export const revalidatePath = "/api/revalidate";
export const revalidateMaxTags = 50;

const courseTagPattern = new RegExp(`^course:${courseSlugPattern.source.slice(1)}`);

export const isKnownCacheTag = (tag: string): boolean =>
  tag === frontPageCacheTag ||
  tag === landingCacheTag ||
  tag === contactCacheTag ||
  tag === newsListCacheTag ||
  tag === resourcesCacheTag ||
  courseTagPattern.test(tag) ||
  newsPostTagPattern.test(tag);

export const revalidateRequestSchema = z.object({
  tags: z.array(z.string().refine(isKnownCacheTag)).min(1).max(revalidateMaxTags),
});

export type RevalidateRequest = z.infer<typeof revalidateRequestSchema>;
