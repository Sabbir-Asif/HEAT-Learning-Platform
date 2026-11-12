import { z } from "zod";
import { adminPageSizes } from "./admins";

export const resourceTitleMaxLength = 200;

export const resourceDescriptionMaxLength = 1000;

export const resourceUrlMaxLength = 2000;

export const resourceDisplayOrderMax = 100000;

export const resourceKinds = ["file", "link"] as const;

export type ResourceKind = (typeof resourceKinds)[number];

export const resourceListStatuses = ["all", "published", "unpublished"] as const;

export const resourceSortFields = [
  "title",
  "-title",
  "displayOrder",
  "-displayOrder",
  "updatedAt",
  "-updatedAt",
] as const;

export const resourcesCacheTag = "resources";

export const resourceUrlMessage = "Enter a web address that starts with https://.";

export const isHttpsUrl = (value: string): boolean => {
  if (value.length > resourceUrlMaxLength) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname !== "";
  } catch {
    return false;
  }
};

export const resourceUrlSchema = z.string().trim().refine(isHttpsUrl, resourceUrlMessage);

export const resourceTitleSchema = z
  .string()
  .trim()
  .min(1, "Enter the title.")
  .max(resourceTitleMaxLength, `Use at most ${resourceTitleMaxLength} characters.`);

export const resourceDescriptionSchema = z
  .string()
  .trim()
  .max(resourceDescriptionMaxLength, `Use at most ${resourceDescriptionMaxLength} characters.`);

const displayOrderSchema = z.number().int().min(0).max(resourceDisplayOrderMax);

export const resourceRequestSchema = z
  .object({
    kind: z.enum(resourceKinds),
    title: resourceTitleSchema,
    description: resourceDescriptionSchema.nullable().default(null),
    url: resourceUrlSchema.nullable().default(null),
    mediaAssetId: z.uuid().nullable().default(null),
    courseId: z.uuid().nullable().default(null),
    displayOrder: displayOrderSchema.default(0),
    published: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.kind === "link") {
      if (value.url === null) {
        context.addIssue({ code: "custom", path: ["url"], message: resourceUrlMessage });
      }
      if (value.mediaAssetId !== null) {
        context.addIssue({ code: "custom", path: ["mediaAssetId"], message: "Remove the file." });
      }
      return;
    }
    if (value.mediaAssetId === null) {
      context.addIssue({ code: "custom", path: ["mediaAssetId"], message: "Upload a file." });
    }
    if (value.url !== null) {
      context.addIssue({ code: "custom", path: ["url"], message: "Remove the web address." });
    }
  });

export type ResourceRequest = z.infer<typeof resourceRequestSchema>;

export const resourceFormSchema = z
  .object({
    kind: z.enum(resourceKinds),
    title: resourceTitleSchema,
    description: resourceDescriptionSchema,
    url: z.string().trim(),
    mediaAssetId: z.string(),
    courseId: z.string(),
    displayOrder: z.string().trim().regex(/^\d{1,6}$/, "Enter a whole number, 0 or more."),
    published: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.kind === "link" && !isHttpsUrl(value.url)) {
      context.addIssue({ code: "custom", path: ["url"], message: resourceUrlMessage });
    }
    if (value.kind === "file" && value.mediaAssetId === "") {
      context.addIssue({ code: "custom", path: ["mediaAssetId"], message: "Upload a file." });
    }
  });

export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

export const resourceRequestFromForm = (values: ResourceFormValues): ResourceRequest => ({
  kind: values.kind,
  title: values.title,
  description: values.description === "" ? null : values.description,
  url: values.kind === "link" ? values.url : null,
  mediaAssetId: values.kind === "file" ? values.mediaAssetId : null,
  courseId: values.courseId === "" ? null : values.courseId,
  displayOrder: Number(values.displayOrder),
  published: values.published,
});

export const resourceIdParamsSchema = z.object({ id: z.uuid() });

export const resourceAdminListQuerySchema = z.object({
  status: z.enum(resourceListStatuses).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
  sort: z.enum(resourceSortFields).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export type ResourceAdminListQuery = z.infer<typeof resourceAdminListQuerySchema>;

export const resourceFileSchema = z.object({
  assetId: z.uuid(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  url: z.string(),
});

export type ResourceFile = z.infer<typeof resourceFileSchema>;

export const resourceAdminSchema = z.object({
  id: z.uuid(),
  kind: z.enum(resourceKinds),
  title: z.string(),
  description: z.string().nullable(),
  url: z.string().nullable(),
  file: resourceFileSchema.nullable(),
  courseId: z.uuid().nullable(),
  courseTitle: z.string().nullable(),
  displayOrder: z.number().int(),
  published: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ResourceAdmin = z.infer<typeof resourceAdminSchema>;

export const resourceAdminListResponseSchema = z.object({
  items: z.array(resourceAdminSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type ResourceAdminListResponse = z.infer<typeof resourceAdminListResponseSchema>;

export const resourcePublicSchema = z.object({
  id: z.uuid(),
  kind: z.enum(resourceKinds),
  title: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
});

export type ResourcePublic = z.infer<typeof resourcePublicSchema>;

export const resourcePublicListResponseSchema = z.object({
  items: z.array(resourcePublicSchema),
});

export type ResourcePublicListResponse = z.infer<typeof resourcePublicListResponseSchema>;

export const resourcePublicLimit = 200;

const fileTypeLabels: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
};

export const resourceTypeLabel = (kind: ResourceKind, mimeType: string | null): string => {
  if (kind === "link") return "Link";
  return (mimeType === null ? undefined : fileTypeLabels[mimeType]) ?? "File";
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
