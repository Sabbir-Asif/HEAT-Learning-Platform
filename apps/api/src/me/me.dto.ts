import { meResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class MeResponseDto extends createZodDto(meResponseSchema) {}
