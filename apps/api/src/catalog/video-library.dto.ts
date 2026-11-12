import { videoLibraryListQuerySchema, videoLibraryListResponseSchema } from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class VideoLibraryListQueryDto extends createZodDto(videoLibraryListQuerySchema) {}
export class VideoLibraryListResponseDto extends createZodDto(videoLibraryListResponseSchema) {}
