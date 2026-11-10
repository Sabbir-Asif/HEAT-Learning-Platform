import { captchaRequestSchema, captchaResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CaptchaRequestDto extends createZodDto(captchaRequestSchema) {}
export class CaptchaResponseDto extends createZodDto(captchaResponseSchema) {}
