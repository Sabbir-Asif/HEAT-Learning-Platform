import {
  mediaAssetResponseSchema,
  mediaFileParamsSchema,
  mediaUploadFieldsSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class MediaUploadFieldsDto extends createZodDto(mediaUploadFieldsSchema) {}
export class MediaAssetResponseDto extends createZodDto(mediaAssetResponseSchema) {}
export class MediaFileParamsDto extends createZodDto(mediaFileParamsSchema) {}
