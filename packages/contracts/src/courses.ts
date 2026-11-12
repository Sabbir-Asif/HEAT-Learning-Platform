import { z } from "zod";
import { adminPageSizes } from "./admins";

export const courseTitleMaxLength = 200;
export const courseSlugMaxLength = 80;
export const courseDescriptionMaxLength = 5000;

const hiddenCharacters = /[\p{Cc}\p{Cf}]/u;

export const courseSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const courseTitleSchema = z
  .string()
  .trim()
  .transform((value) => value.normalize("NFC").replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter the course title.")
      .max(courseTitleMaxLength, `Use at most ${courseTitleMaxLength} characters.`)
      .refine(
        (value) => !hiddenCharacters.test(value),
        "Remove control, invisible or text direction characters.",
      ),
  );

export const courseSlugSchema = z
  .string()
  .trim()
  .min(1, "Enter the course slug.")
  .max(courseSlugMaxLength, `Use at most ${courseSlugMaxLength} characters.`)
  .regex(courseSlugPattern, "Use lowercase letters, digits and single hyphens.");

export const courseDescriptionSchema = z
  .string()
  .trim()
  .max(courseDescriptionMaxLength, `Use at most ${courseDescriptionMaxLength} characters.`)
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const createCourseRequestSchema = z.object({
  title: courseTitleSchema,
  slug: courseSlugSchema,
  description: courseDescriptionSchema.default(null),
  thumbnailAssetId: z.uuid().nullable().default(null),
});

export type CreateCourseRequest = z.infer<typeof createCourseRequestSchema>;

export const updateCourseRequestSchema = createCourseRequestSchema;

export type UpdateCourseRequest = CreateCourseRequest;

export const courseFormSchema = z.object({
  title: courseTitleSchema,
  slug: courseSlugSchema,
  description: z
    .string()
    .trim()
    .max(courseDescriptionMaxLength, `Use at most ${courseDescriptionMaxLength} characters.`),
});

export type CourseFormValues = z.infer<typeof courseFormSchema>;

export const courseStatuses = ["DRAFT", "PUBLISHED"] as const;

export const courseStatusSchema = z.enum(courseStatuses);

export type CourseStatus = z.infer<typeof courseStatusSchema>;

export const courseListStatuses = ["all", "draft", "published"] as const;

export const courseSortFields = [
  "title",
  "-title",
  "createdAt",
  "-createdAt",
  "updatedAt",
  "-updatedAt",
] as const;

export const courseListQuerySchema = z.object({
  status: z.enum(courseListStatuses).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
  sort: z.enum(courseSortFields).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export type CourseListQuery = z.infer<typeof courseListQuerySchema>;

export const courseRevisionSummarySchema = z.object({
  id: z.uuid(),
  number: z.number().int().min(1),
  publishedAt: z.iso.datetime().nullable(),
});

export type CourseRevisionSummary = z.infer<typeof courseRevisionSummarySchema>;

export const courseSummarySchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  description: z.string().max(courseDescriptionMaxLength).nullable(),
  thumbnailAssetId: z.uuid().nullable(),
  status: courseStatusSchema,
  lockedAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  enrollmentCount: z.number().int().min(0),
  currentRevision: courseRevisionSummarySchema.nullable(),
});

export type CourseSummary = z.infer<typeof courseSummarySchema>;

export const courseListResponseSchema = z.object({
  items: z.array(courseSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type CourseListResponse = z.infer<typeof courseListResponseSchema>;

export const courseIdParamsSchema = z.object({ id: z.uuid() });

export const publishFailureCodes = [
  "COURSE_NO_MODULES",
  "MODULE_NO_REQUIRED_VIDEO",
  "MODULE_VIDEO_NOT_READY",
  "MODULE_NO_QUIZ",
  "MODULE_QUIZ_EMPTY",
  "QUESTION_OPTION_COUNT",
  "QUESTION_CORRECT_COUNT",
] as const;

export const publishFailureCodeSchema = z.enum(publishFailureCodes);

export type PublishFailureCode = z.infer<typeof publishFailureCodeSchema>;

export const publishFailureSchema = z.object({
  code: publishFailureCodeSchema,
  moduleId: z.uuid().nullable(),
  questionId: z.uuid().nullable(),
  message: z.string(),
});

export type PublishFailure = z.infer<typeof publishFailureSchema>;

export const publishChecklistSchema = z.object({
  failures: z.array(publishFailureSchema),
});

export type PublishChecklist = z.infer<typeof publishChecklistSchema>;

export const courseRevisionStatuses = ["DRAFT", "PUBLISHED"] as const;

export const courseRevisionStatusSchema = z.enum(courseRevisionStatuses);

export type CourseRevisionStatus = z.infer<typeof courseRevisionStatusSchema>;

export const courseRevisionItemSchema = z.object({
  id: z.uuid(),
  number: z.number().int().min(1),
  status: courseRevisionStatusSchema,
  locked: z.boolean(),
  current: z.boolean(),
  enrollmentCount: z.number().int().min(0),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type CourseRevisionItem = z.infer<typeof courseRevisionItemSchema>;

export const courseRevisionListResponseSchema = z.object({
  items: z.array(courseRevisionItemSchema),
});

export type CourseRevisionListResponse = z.infer<typeof courseRevisionListResponseSchema>;

export const courseRevisionParamsSchema = z.object({ id: z.uuid(), revisionId: z.uuid() });
