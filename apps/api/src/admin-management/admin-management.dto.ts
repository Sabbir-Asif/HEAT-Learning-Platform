import {
  acceptInviteRequestSchema,
  adminIdParamsSchema,
  adminListQuerySchema,
  adminListResponseSchema,
  adminSummarySchema,
  invitationLookupResponseSchema,
  invitationLookupRequestSchema,
  inviteAdminRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class InviteAdminRequestDto extends createZodDto(inviteAdminRequestSchema) {}

export class AdminSummaryDto extends createZodDto(adminSummarySchema) {}

export class AdminListQueryDto extends createZodDto(adminListQuerySchema) {}

export class AdminListResponseDto extends createZodDto(adminListResponseSchema) {}

export class AdminIdParamsDto extends createZodDto(adminIdParamsSchema) {}

export class InvitationLookupResponseDto extends createZodDto(invitationLookupResponseSchema) {}

export class InvitationLookupRequestDto extends createZodDto(invitationLookupRequestSchema) {}

export class AcceptInviteRequestDto extends createZodDto(acceptInviteRequestSchema) {}
