import { z } from "zod";
import { courseDescriptionMaxLength } from "./courses";

export const tagNameMaxLength = 60;
export const tagTagsMaxCount = 50;
export const frontpageTagSlug = "frontpage";

const hiddenCharacters = /[\p{Cc}\p{Cf}]/u;

export const tagSlugOf = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const tagNameSchema = z
  .string()
  .trim()
  .transform((value) => value.normalize("NFC").replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter the tag name.")
      .max(tagNameMaxLength, `Use at most ${tagNameMaxLength} characters.`)
      .refine(
        (value) => !hiddenCharacters.test(value),
        "Remove control, invisible or text direction characters.",
      )
      .refine((value) => tagSlugOf(value) !== "", "Use at least one letter or digit."),
  );

export const createTagRequestSchema = z.object({ name: tagNameSchema });

export type CreateTagRequest = z.infer<typeof createTagRequestSchema>;

export const updateTagRequestSchema = createTagRequestSchema;

export type UpdateTagRequest = CreateTagRequest;

export const tagIdParamsSchema = z.object({ id: z.uuid() });

export const tagSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  courseCount: z.number().int().min(0),
  moduleCount: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TagSummary = z.infer<typeof tagSummarySchema>;

export const tagListResponseSchema = z.object({ items: z.array(tagSummarySchema) });

export type TagListResponse = z.infer<typeof tagListResponseSchema>;

export const tagDetailSchema = tagSummarySchema.extend({
  courses: z.array(z.object({ id: z.uuid(), title: z.string() })),
  modules: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      courseId: z.uuid(),
      courseTitle: z.string(),
    }),
  ),
});

export type TagDetail = z.infer<typeof tagDetailSchema>;

export const tagRefSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
});

export type TagRef = z.infer<typeof tagRefSchema>;

export const tagRefListResponseSchema = z.object({ items: z.array(tagRefSchema) });

export type TagRefListResponse = z.infer<typeof tagRefListResponseSchema>;

export const setTagsRequestSchema = z.object({
  tagIds: z
    .array(z.uuid())
    .max(tagTagsMaxCount)
    .refine((ids) => new Set(ids).size === ids.length, "Each tag can appear once."),
});

export type SetTagsRequest = z.infer<typeof setTagsRequestSchema>;

export const frontPageCourseSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  published: z.boolean(),
});

export const frontPageModuleSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  courseId: z.uuid(),
  courseTitle: z.string(),
  published: z.boolean(),
});

export const adminFrontPageResponseSchema = z.object({
  courses: z.array(frontPageCourseSchema),
  modules: z.array(frontPageModuleSchema),
});

export type AdminFrontPageResponse = z.infer<typeof adminFrontPageResponseSchema>;

export const publicFrontPageResponseSchema = z.object({
  courses: z.array(
    z.object({
      id: z.uuid(),
      slug: z.string(),
      title: z.string(),
      description: z.string().max(courseDescriptionMaxLength).nullable(),
      thumbnailAssetId: z.uuid().nullable(),
    }),
  ),
  modules: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      courseSlug: z.string(),
      courseTitle: z.string(),
    }),
  ),
});

export type PublicFrontPageResponse = z.infer<typeof publicFrontPageResponseSchema>;
