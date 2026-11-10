import { z } from "zod";
import { adminPageSizes } from "./admins";

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
  }, "Enter a real date.");

const filterText = z.string().trim().min(1).max(120);

export const auditLogListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
      .default(25),
    actor: filterText.optional(),
    action: filterText.optional(),
    entity: filterText.optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: "The end date must not be before the start date.",
    path: ["to"],
  });

export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

export const auditLogEntrySchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  actorId: z.uuid().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  requestId: z.string().nullable(),
  ipAddress: z.string().nullable(),
});

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

export const auditLogListResponseSchema = z.object({
  items: z.array(auditLogEntrySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>;
