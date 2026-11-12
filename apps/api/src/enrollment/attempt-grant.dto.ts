import {
  attemptGrantParamsSchema,
  grantAttemptRequestSchema,
  grantedAttemptSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class AttemptGrantParamsDto extends createZodDto(attemptGrantParamsSchema) {}
export class GrantAttemptRequestDto extends createZodDto(grantAttemptRequestSchema) {}
export class GrantedAttemptDto extends createZodDto(grantedAttemptSchema) {}
