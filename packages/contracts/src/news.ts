import { z } from "zod";
import { adminPageSizes } from "./admins";
import { courseSlugPattern, courseSlugSchema } from "./courses";
import { lessonBodyImageSchema, richTextBodySchema, richTextSchemaVersion } from "./rich-text";

export const newsTitleMaxLength = 200;

export const newsPublishedEventType = "news.published";

export const newsPublishedPayloadSchema = z.object({
  postId: z.uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
});

export type NewsPublishedPayload = z.infer<typeof newsPublishedPayloadSchema>;

export const newsTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter the title.")
  .max(newsTitleMaxLength, `Use at most ${newsTitleMaxLength} characters.`);

export const newsEditorStatuses = ["draft", "published"] as const;

export const newsStatuses = ["draft", "scheduled", "published"] as const;

export type NewsStatus = (typeof newsStatuses)[number];

export const newsListStatuses = ["all", ...newsStatuses] as const;

export const newsSortFields = [
  "title",
  "-title",
  "publishedAt",
  "-publishedAt",
  "updatedAt",
  "-updatedAt",
] as const;

export const newsPostRequestSchema = z.object({
  title: newsTitleSchema,
  schemaVersion: z.literal(richTextSchemaVersion),
  body: richTextBodySchema,
  status: z.enum(newsEditorStatuses),
  publishedAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

export type NewsPostRequest = z.infer<typeof newsPostRequestSchema>;

export const newsPostFormSchema = z.object({
  title: newsTitleSchema,
  status: z.enum(newsEditorStatuses),
  publishAt: z.string().trim(),
});

export type NewsPostFormValues = z.infer<typeof newsPostFormSchema>;

export const dhakaOffset = "+06:00";

const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const dhakaLocalToIso = (local: string): string | null => {
  const trimmed = local.trim();
  if (!localDateTimePattern.test(trimmed)) return null;
  const instant = new Date(`${trimmed}:00${dhakaOffset}`);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
};

export const isoToDhakaLocal = (iso: string | null): string => {
  if (iso === null) return "";
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const shifted = new Date(instant.getTime() + 6 * 3600 * 1000);
  return shifted.toISOString().slice(0, 16);
};

export const newsIdParamsSchema = z.object({ id: z.uuid() });

export const newsSlugParamsSchema = z.object({ slug: courseSlugSchema });

export const newsAdminListQuerySchema = z.object({
  status: z.enum(newsListStatuses).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
  sort: z.enum(newsSortFields).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export type NewsAdminListQuery = z.infer<typeof newsAdminListQuerySchema>;

export const newsPublicPageSize = 10;

export const newsPublicListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export type NewsPublicListQuery = z.infer<typeof newsPublicListQuerySchema>;

export const newsAdminSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  status: z.enum(newsStatuses),
  publishedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});

export type NewsAdminSummary = z.infer<typeof newsAdminSummarySchema>;

export const newsAdminListResponseSchema = z.object({
  items: z.array(newsAdminSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type NewsAdminListResponse = z.infer<typeof newsAdminListResponseSchema>;

export const newsAdminPostSchema = newsAdminSummarySchema.extend({
  authorId: z.uuid(),
  schemaVersion: z.number().int().min(1),
  body: z.record(z.string(), z.unknown()),
  images: z.array(lessonBodyImageSchema),
  createdAt: z.iso.datetime(),
});

export type NewsAdminPost = z.infer<typeof newsAdminPostSchema>;

export const newsPublicSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  publishedAt: z.iso.datetime(),
  cover: lessonBodyImageSchema.nullable(),
});

export type NewsPublicSummary = z.infer<typeof newsPublicSummarySchema>;

export const newsPublicListResponseSchema = z.object({
  items: z.array(newsPublicSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type NewsPublicListResponse = z.infer<typeof newsPublicListResponseSchema>;

export const newsPublicPostSchema = z.object({
  slug: z.string(),
  title: z.string(),
  publishedAt: z.iso.datetime(),
  schemaVersion: z.number().int().min(1),
  body: z.record(z.string(), z.unknown()),
  images: z.array(lessonBodyImageSchema),
});

export type NewsPublicPost = z.infer<typeof newsPublicPostSchema>;

export const newsListCacheTag = "news";

export const newsPostCacheTag = (slug: string): string => `news:${slug}`;

export const newsPostTagPattern = new RegExp(`^news:${courseSlugPattern.source.slice(1)}`);
