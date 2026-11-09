import { adminMeResponseSchema, changePasswordRequestSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class AdminMeResponseDto extends createZodDto(adminMeResponseSchema) {}

export class ChangePasswordRequestDto extends createZodDto(changePasswordRequestSchema) {}
