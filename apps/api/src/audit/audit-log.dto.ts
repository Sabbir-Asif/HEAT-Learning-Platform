import { auditLogListQuerySchema, auditLogListResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class AuditLogListQueryDto extends createZodDto(auditLogListQuerySchema) {}

export class AuditLogListResponseDto extends createZodDto(auditLogListResponseSchema) {}
