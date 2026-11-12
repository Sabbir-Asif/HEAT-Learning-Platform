import {
  newsAdminListQuerySchema,
  newsAdminListResponseSchema,
  newsAdminPostSchema,
  newsIdParamsSchema,
  newsPostRequestSchema,
  newsPublicListQuerySchema,
  newsPublicListResponseSchema,
  newsPublicPostSchema,
  newsSlugParamsSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class NewsPostRequestDto extends createZodDto(newsPostRequestSchema) {}

export class NewsAdminListQueryDto extends createZodDto(newsAdminListQuerySchema) {}

export class NewsAdminListResponseDto extends createZodDto(newsAdminListResponseSchema) {}

export class NewsAdminPostDto extends createZodDto(newsAdminPostSchema) {}

export class NewsIdParamsDto extends createZodDto(newsIdParamsSchema) {}

export class NewsSlugParamsDto extends createZodDto(newsSlugParamsSchema) {}

export class NewsPublicListQueryDto extends createZodDto(newsPublicListQuerySchema) {}

export class NewsPublicListResponseDto extends createZodDto(newsPublicListResponseSchema) {}

export class NewsPublicPostDto extends createZodDto(newsPublicPostSchema) {}
