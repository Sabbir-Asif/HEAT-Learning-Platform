import {
  avatarResponseSchema,
  changeStudentPasswordRequestSchema,
  passwordCodeRequestedResponseSchema,
  profileResponseSchema,
  updateProfileRequestSchema,
} from "@heat/contracts";
import { createZodDto } from "nestjs-zod";

export class ProfileResponseDto extends createZodDto(profileResponseSchema) {}
export class UpdateProfileRequestDto extends createZodDto(updateProfileRequestSchema) {}
export class AvatarResponseDto extends createZodDto(avatarResponseSchema) {}
export class ChangeStudentPasswordRequestDto extends createZodDto(
  changeStudentPasswordRequestSchema,
) {}
export class PasswordCodeRequestedResponseDto extends createZodDto(
  passwordCodeRequestedResponseSchema,
) {}
