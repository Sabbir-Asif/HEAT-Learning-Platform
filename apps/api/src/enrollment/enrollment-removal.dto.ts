import {
  reinstateEnrollmentRequestSchema,
  reinstatedEnrollmentSchema,
  removeEnrollmentRequestSchema,
  removedEnrollmentSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class RemoveEnrollmentRequestDto extends createZodDto(removeEnrollmentRequestSchema) {}
export class ReinstateEnrollmentRequestDto extends createZodDto(reinstateEnrollmentRequestSchema) {}
export class RemovedEnrollmentDto extends createZodDto(removedEnrollmentSchema) {}
export class ReinstatedEnrollmentDto extends createZodDto(reinstatedEnrollmentSchema) {}
