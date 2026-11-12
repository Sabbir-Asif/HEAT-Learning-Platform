import {
  enrollmentAcceptedResponseSchema,
  forgotPasswordRequestSchema,
  resetPasswordRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class ForgotPasswordRequestDto extends createZodDto(forgotPasswordRequestSchema) {}
export class ResetPasswordRequestDto extends createZodDto(resetPasswordRequestSchema) {}
export class ForgotPasswordAcceptedResponseDto extends createZodDto(
  enrollmentAcceptedResponseSchema,
) {}
