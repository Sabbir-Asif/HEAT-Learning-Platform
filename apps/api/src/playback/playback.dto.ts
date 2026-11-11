import { playbackSessionResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class PlaybackSessionResponseDto extends createZodDto(playbackSessionResponseSchema) {}
