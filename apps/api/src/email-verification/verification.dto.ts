import {
  enrollmentAcceptedResponseSchema,
  verificationResendRequestSchema,
  verifyEmailRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class VerifyEmailRequestDto extends createZodDto(verifyEmailRequestSchema) {}
export class VerificationResendRequestDto extends createZodDto(verificationResendRequestSchema) {}
export class VerificationAcceptedResponseDto extends createZodDto(
  enrollmentAcceptedResponseSchema,
) {}
