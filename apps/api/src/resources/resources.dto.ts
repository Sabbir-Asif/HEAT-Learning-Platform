import {
  resourceAdminListQuerySchema,
  resourceAdminListResponseSchema,
  resourceAdminSchema,
  resourceIdParamsSchema,
  resourcePublicListResponseSchema,
  resourceRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class ResourceRequestDto extends createZodDto(resourceRequestSchema) {}

export class ResourceAdminListQueryDto extends createZodDto(resourceAdminListQuerySchema) {}

export class ResourceAdminListResponseDto extends createZodDto(resourceAdminListResponseSchema) {}

export class ResourceAdminDto extends createZodDto(resourceAdminSchema) {}

export class ResourceIdParamsDto extends createZodDto(resourceIdParamsSchema) {}

export class ResourcePublicListResponseDto extends createZodDto(resourcePublicListResponseSchema) {}
