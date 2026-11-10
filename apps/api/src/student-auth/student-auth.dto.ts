import { csrfTokenResponseSchema, signInRequestSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class SignInRequestDto extends createZodDto(signInRequestSchema) {}

export class CsrfTokenResponseDto extends createZodDto(csrfTokenResponseSchema) {}
