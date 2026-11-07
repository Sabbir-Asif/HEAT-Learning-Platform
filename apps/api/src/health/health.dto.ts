import { healthResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class HealthResponseDto extends createZodDto(healthResponseSchema) {}
