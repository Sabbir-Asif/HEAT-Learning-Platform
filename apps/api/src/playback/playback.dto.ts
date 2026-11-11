import {
  playbackAdminParamsSchema,
  playbackSessionResponseSchema,
  playbackVideoParamsSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class PlaybackSessionResponseDto extends createZodDto(playbackSessionResponseSchema) {}
export class PlaybackVideoParamsDto extends createZodDto(playbackVideoParamsSchema) {}
export class AdminPlaybackParamsDto extends createZodDto(playbackAdminParamsSchema) {}
