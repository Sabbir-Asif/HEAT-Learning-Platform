import {
  avatarResponseSchema,
  profileResponseSchema,
  updateProfileRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class ProfileResponseDto extends createZodDto(profileResponseSchema) {}
export class UpdateProfileRequestDto extends createZodDto(updateProfileRequestSchema) {}
export class AvatarResponseDto extends createZodDto(avatarResponseSchema) {}
