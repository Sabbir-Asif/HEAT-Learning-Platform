import { studentListQuerySchema, studentListResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class StudentListQueryDto extends createZodDto(studentListQuerySchema) {}
export class StudentListResponseDto extends createZodDto(studentListResponseSchema) {}
