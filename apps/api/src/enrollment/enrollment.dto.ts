import { enrollmentAcceptedResponseSchema, enrollmentRequestSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class EnrollmentRequestDto extends createZodDto(enrollmentRequestSchema) {}
export class EnrollmentAcceptedResponseDto extends createZodDto(enrollmentAcceptedResponseSchema) {}
