import { studentExportQuerySchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class StudentExportQueryDto extends createZodDto(studentExportQuerySchema) {}
