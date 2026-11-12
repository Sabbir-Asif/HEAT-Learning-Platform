import { z } from "zod";
import { academicSessionSchema } from "./academic-session";
import { adminPageSizes } from "./admins";
import { enrollmentStatusSchema } from "./auth";

export const studentSortFields = ["name", "-name", "requestedAt", "-requestedAt"] as const;
export const studentSearchMaxLength = 100;

const optionalUuid = z.uuid().optional();

export const studentListQuerySchema = z.object({
  courseId: optionalUuid,
  universityId: optionalUuid,
  facultyId: optionalUuid,
  departmentId: optionalUuid,
  session: academicSessionSchema.optional(),
  status: enrollmentStatusSchema.optional(),
  q: z
    .string()
    .trim()
    .max(studentSearchMaxLength)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  sort: z.enum(studentSortFields).default("name"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
});

export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
export type StudentListQueryInput = z.input<typeof studentListQuerySchema>;

const namedSchema = z.object({ id: z.uuid(), name: z.string() });

export const studentListItemSchema = z.object({
  id: z.uuid(),
  status: enrollmentStatusSchema,
  requestedAt: z.iso.datetime(),
  student: z.object({ userId: z.uuid(), name: z.string(), email: z.string() }),
  course: z.object({ id: z.uuid(), title: z.string() }),
  university: namedSchema,
  faculty: namedSchema,
  department: namedSchema,
  session: z.string(),
});

export type StudentListItem = z.infer<typeof studentListItemSchema>;

export const studentListResponseSchema = z.object({
  items: z.array(studentListItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type StudentListResponse = z.infer<typeof studentListResponseSchema>;
