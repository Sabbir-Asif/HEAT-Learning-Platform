import { signInRequestSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class SignInRequestDto extends createZodDto(signInRequestSchema) {}
