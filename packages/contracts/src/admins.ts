import { z } from "zod";
import { passwordMaxLength, passwordMinLength, userRoleSchema } from "./auth";

export const adminStatuses = ["ACTIVE", "INVITED", "INVITE_EXPIRED", "DEACTIVATED"] as const;
export const adminStatusSchema = z.enum(adminStatuses);
export type AdminStatus = z.infer<typeof adminStatusSchema>;

export const adminPageSizes = [10, 25, 50] as const;
export const adminSortFields = ["email", "-email", "createdAt", "-createdAt"] as const;

export const inviteAdminRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254, "Enter a valid email address.")),
});

export type InviteAdminRequest = z.infer<typeof inviteAdminRequestSchema>;

export const adminSummarySchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: userRoleSchema,
  status: adminStatusSchema,
  createdAt: z.iso.datetime(),
  inviteExpiresAt: z.iso.datetime().nullable(),
  deactivatedAt: z.iso.datetime().nullable(),
});

export type AdminSummary = z.infer<typeof adminSummarySchema>;

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
  sort: z.enum(adminSortFields).optional(),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const adminListResponseSchema = z.object({
  items: z.array(adminSummarySchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type AdminListResponse = z.infer<typeof adminListResponseSchema>;

export const adminIdParamsSchema = z.object({ id: z.uuid() });

export const invitationStatuses = ["VALID", "EXPIRED", "INVALID"] as const;

export const invitationLookupResponseSchema = z.object({
  status: z.enum(invitationStatuses),
  email: z.string().optional(),
});

export type InvitationLookupResponse = z.infer<typeof invitationLookupResponseSchema>;

export const invitationLookupRequestSchema = z.object({
  token: z.string().min(1).max(128),
});

export type InvitationLookupRequest = z.infer<typeof invitationLookupRequestSchema>;

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1, "This invitation link is not valid.").max(128),
  password: z
    .string()
    .min(passwordMinLength, `Use at least ${passwordMinLength} characters.`)
    .max(passwordMaxLength, `Use at most ${passwordMaxLength} characters.`),
});

export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;
