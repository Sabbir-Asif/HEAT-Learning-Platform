import {
  adminMeResponseSchema,
  changePasswordRequestSchema,
  csrfTokenResponseSchema,
  signInRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class AdminMeResponseDto extends createZodDto(adminMeResponseSchema) {}

export class ChangePasswordRequestDto extends createZodDto(changePasswordRequestSchema) {}

export class AdminSignInRequestDto extends createZodDto(signInRequestSchema) {}

export class AdminCsrfTokenResponseDto extends createZodDto(csrfTokenResponseSchema) {}
