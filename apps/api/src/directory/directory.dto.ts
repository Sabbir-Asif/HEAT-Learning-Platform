import {
  createDepartmentRequestSchema,
  departmentIdParamsSchema,
  departmentListQuerySchema,
  departmentListResponseSchema,
  departmentSummarySchema,
  directoryDepartmentLookupParamsSchema,
  directoryFacultyLookupParamsSchema,
  directoryOptionListResponseSchema,
  updateDepartmentRequestSchema,
  createFacultyRequestSchema,
  createUniversityRequestSchema,
  facultyIdParamsSchema,
  facultyListQuerySchema,
  facultyListResponseSchema,
  facultySummarySchema,
  facultyUniversityParamsSchema,
  updateFacultyRequestSchema,
  universityIdParamsSchema,
  universityListQuerySchema,
  universityListResponseSchema,
  universitySummarySchema,
  updateUniversityRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class CreateUniversityRequestDto extends createZodDto(createUniversityRequestSchema) {}

export class UpdateUniversityRequestDto extends createZodDto(updateUniversityRequestSchema) {}

export class UniversityListQueryDto extends createZodDto(universityListQuerySchema) {}

export class UniversityListResponseDto extends createZodDto(universityListResponseSchema) {}

export class UniversitySummaryDto extends createZodDto(universitySummarySchema) {}

export class UniversityIdParamsDto extends createZodDto(universityIdParamsSchema) {}

export class CreateFacultyRequestDto extends createZodDto(createFacultyRequestSchema) {}

export class UpdateFacultyRequestDto extends createZodDto(updateFacultyRequestSchema) {}

export class FacultyListQueryDto extends createZodDto(facultyListQuerySchema) {}

export class FacultyListResponseDto extends createZodDto(facultyListResponseSchema) {}

export class FacultySummaryDto extends createZodDto(facultySummarySchema) {}

export class FacultyIdParamsDto extends createZodDto(facultyIdParamsSchema) {}

export class FacultyUniversityParamsDto extends createZodDto(facultyUniversityParamsSchema) {}

export class CreateDepartmentRequestDto extends createZodDto(createDepartmentRequestSchema) {}

export class UpdateDepartmentRequestDto extends createZodDto(updateDepartmentRequestSchema) {}

export class DepartmentListQueryDto extends createZodDto(departmentListQuerySchema) {}

export class DepartmentListResponseDto extends createZodDto(departmentListResponseSchema) {}

export class DepartmentSummaryDto extends createZodDto(departmentSummarySchema) {}

export class DepartmentIdParamsDto extends createZodDto(departmentIdParamsSchema) {}

export class DirectoryOptionListResponseDto extends createZodDto(
  directoryOptionListResponseSchema,
) {}

export class DirectoryFacultyLookupParamsDto extends createZodDto(
  directoryFacultyLookupParamsSchema,
) {}

export class DirectoryDepartmentLookupParamsDto extends createZodDto(
  directoryDepartmentLookupParamsSchema,
) {}
