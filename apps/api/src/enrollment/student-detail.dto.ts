import { studentDetailParamsSchema, studentDetailSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class StudentDetailParamsDto extends createZodDto(studentDetailParamsSchema) {}
export class StudentDetailResponseDto extends createZodDto(studentDetailSchema) {}
