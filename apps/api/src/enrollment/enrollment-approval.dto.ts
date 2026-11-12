import {
  approvalQueueQuerySchema,
  approvalQueueResponseSchema,
  approveEnrollmentRequestSchema,
  approveEnrollmentsRequestSchema,
  approvedEnrollmentSchema,
  bulkApprovalResponseSchema,
  bulkRejectionResponseSchema,
  enrollmentIdParamsSchema,
  rejectEnrollmentRequestSchema,
  rejectEnrollmentsRequestSchema,
  rejectedEnrollmentSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class ApprovalQueueQueryDto extends createZodDto(approvalQueueQuerySchema) {}
export class ApprovalQueueResponseDto extends createZodDto(approvalQueueResponseSchema) {}
export class ApproveEnrollmentRequestDto extends createZodDto(approveEnrollmentRequestSchema) {}
export class ApproveEnrollmentsRequestDto extends createZodDto(approveEnrollmentsRequestSchema) {}
export class ApprovedEnrollmentDto extends createZodDto(approvedEnrollmentSchema) {}
export class BulkApprovalResponseDto extends createZodDto(bulkApprovalResponseSchema) {}
export class EnrollmentIdParamsDto extends createZodDto(enrollmentIdParamsSchema) {}
export class RejectEnrollmentRequestDto extends createZodDto(rejectEnrollmentRequestSchema) {}
export class RejectEnrollmentsRequestDto extends createZodDto(rejectEnrollmentsRequestSchema) {}
export class RejectedEnrollmentDto extends createZodDto(rejectedEnrollmentSchema) {}
export class BulkRejectionResponseDto extends createZodDto(bulkRejectionResponseSchema) {}
