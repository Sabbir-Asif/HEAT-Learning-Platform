import { z } from "zod";
import { adminPageSizes } from "./admins";

export const universityNameMaxLength = 200;

const directoryNameSchema = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, `Enter the ${label} name.`)
        .max(universityNameMaxLength, `Use at most ${universityNameMaxLength} characters.`),
    );

export const universityNameSchema = directoryNameSchema("university");

export const createUniversityRequestSchema = z.object({ name: universityNameSchema });

export type CreateUniversityRequest = z.infer<typeof createUniversityRequestSchema>;

export const updateUniversityRequestSchema = createUniversityRequestSchema;

export type UpdateUniversityRequest = CreateUniversityRequest;

export const universitySortFields = ["name", "-name", "createdAt", "-createdAt"] as const;

const directoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
  sort: z.enum(universitySortFields).optional(),
  q: z.string().trim().min(1).max(120).optional(),
});

export const universityListQuerySchema = directoryListQuerySchema;

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

export const facultyNameMaxLength = universityNameMaxLength;

export const facultyNameSchema = directoryNameSchema("faculty");

export const createFacultyRequestSchema = z.object({ name: facultyNameSchema });

export type CreateFacultyRequest = z.infer<typeof createFacultyRequestSchema>;

export const facultyFormSchema = createFacultyRequestSchema.extend({
  universityIds: z.array(z.uuid()),
});

export type FacultyFormValues = z.infer<typeof facultyFormSchema>;

export const updateFacultyRequestSchema = createFacultyRequestSchema;

export type UpdateFacultyRequest = CreateFacultyRequest;

export const facultySortFields = universitySortFields;

export const facultyListQuerySchema = directoryListQuerySchema.extend({
  universityId: z.uuid().optional(),
});

export type FacultyListQuery = z.infer<typeof facultyListQuerySchema>;

export const facultyUniversitySchema = z.object({ id: z.uuid(), name: z.string() });

export type FacultyUniversity = z.infer<typeof facultyUniversitySchema>;

export const facultySummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  studentCount: z.number().int().min(0),
  departmentCount: z.number().int().min(0),
  universities: z.array(facultyUniversitySchema),
});

export type FacultySummary = z.infer<typeof facultySummarySchema>;

export const facultyListResponseSchema = z.object({
  items: z.array(facultySummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type FacultyListResponse = z.infer<typeof facultyListResponseSchema>;

export const facultyIdParamsSchema = z.object({ id: z.uuid() });

export const facultyUniversityParamsSchema = z.object({
  id: z.uuid(),
  universityId: z.uuid(),
});

export const departmentNameMaxLength = universityNameMaxLength;

export const departmentNameSchema = directoryNameSchema("department");

export const createDepartmentRequestSchema = z.object({
  name: departmentNameSchema,
  universityId: z.uuid(),
  facultyId: z.uuid(),
});

export type CreateDepartmentRequest = z.infer<typeof createDepartmentRequestSchema>;

export const updateDepartmentRequestSchema = createDepartmentRequestSchema;

export type UpdateDepartmentRequest = CreateDepartmentRequest;

export const departmentSortFields = universitySortFields;

export const departmentListQuerySchema = directoryListQuerySchema.extend({
  universityId: z.uuid().optional(),
  facultyId: z.uuid().optional(),
});

export type DepartmentListQuery = z.infer<typeof departmentListQuerySchema>;

export const departmentSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  university: facultyUniversitySchema,
  faculty: z.object({ id: z.uuid(), name: z.string() }),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  studentCount: z.number().int().min(0),
});

export type DepartmentSummary = z.infer<typeof departmentSummarySchema>;

export const departmentListResponseSchema = z.object({
  items: z.array(departmentSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type DepartmentListResponse = z.infer<typeof departmentListResponseSchema>;

export const departmentIdParamsSchema = z.object({ id: z.uuid() });
