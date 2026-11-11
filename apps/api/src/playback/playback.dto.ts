import {
  playbackAdminParamsSchema,
  playbackSessionResponseSchema,
  playbackVideoParamsSchema,
  progressBatchSchema,
  progressResponseSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class PlaybackSessionResponseDto extends createZodDto(playbackSessionResponseSchema) {}
export class PlaybackVideoParamsDto extends createZodDto(playbackVideoParamsSchema) {}
export class AdminPlaybackParamsDto extends createZodDto(playbackAdminParamsSchema) {}
export class ProgressBatchDto extends createZodDto(progressBatchSchema) {}
export class ProgressResponseDto extends createZodDto(progressResponseSchema) {}
