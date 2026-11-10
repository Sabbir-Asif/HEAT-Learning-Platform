import { z } from "zod";
import { adminPageSizes } from "./admins";

export const universityNameMaxLength = 200;

export const universityNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter the university name.")
      .max(universityNameMaxLength, `Use at most ${universityNameMaxLength} characters.`),
  );

export const createUniversityRequestSchema = z.object({ name: universityNameSchema });

export type CreateUniversityRequest = z.infer<typeof createUniversityRequestSchema>;

export const updateUniversityRequestSchema = createUniversityRequestSchema;

export type UpdateUniversityRequest = CreateUniversityRequest;

export const universitySortFields = ["name", "-name", "createdAt", "-createdAt"] as const;

export const universityListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
  sort: z.enum(universitySortFields).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export type UniversityListQuery = z.infer<typeof universityListQuerySchema>;

export const universitySummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  studentCount: z.number().int().min(0),
  departmentCount: z.number().int().min(0),
  facultyCount: z.number().int().min(0),
});

export type UniversitySummary = z.infer<typeof universitySummarySchema>;

export const universityListResponseSchema = z.object({
  items: z.array(universitySummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type UniversityListResponse = z.infer<typeof universityListResponseSchema>;

export const universityIdParamsSchema = z.object({ id: z.uuid() });
