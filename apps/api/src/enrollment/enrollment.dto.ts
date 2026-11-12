import {
  enrollmentAcceptedResponseSchema,
  enrollmentRequestSchema,
  signedInEnrollmentRequestSchema,
  signedInEnrollmentResponseSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class EnrollmentRequestDto extends createZodDto(enrollmentRequestSchema) {}
export class EnrollmentAcceptedResponseDto extends createZodDto(enrollmentAcceptedResponseSchema) {}
export class SignedInEnrollmentRequestDto extends createZodDto(signedInEnrollmentRequestSchema) {}
export class SignedInEnrollmentResponseDto extends createZodDto(signedInEnrollmentResponseSchema) {}
