import { mediaLimits } from "@heat/contracts";
import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiExcludeEndpoint, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Audience } from "../access";
import { Audited } from "../audit";
import { CurrentSession } from "../auth";
import type { AuthenticatedSession } from "../auth";
import { ApiException } from "../http/api-exception";
import { RateLimit } from "../rate-limit";
import { AvatarResponseDto, ProfileResponseDto, UpdateProfileRequestDto } from "./profile.dto";
import { ProfileService } from "./profile.service";

@ApiTags("me")
@Controller("me/profile")
@Audience("student")
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @ApiOkResponse({ type: ProfileResponseDto })
  describe(@CurrentSession() session: AuthenticatedSession): Promise<ProfileResponseDto> {
    return this.profile.describe(session.userId);
  }

  @Patch()
  @Audited({ action: "profile.update", entity: "StudentProfile" })
  @ApiOkResponse({ type: ProfileResponseDto })
  update(
    @Body() body: UpdateProfileRequestDto,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<ProfileResponseDto> {
    return this.profile.update(session.userId, body);
  }

  @Put("avatar")
  @RateLimit("mediaUpload")
  @Audited({ action: "profile.avatar.put", entity: "MediaAsset" })
  @ApiExcludeEndpoint()
  @UseInterceptors(
    FileInterceptor("file", { limits: { files: 1, fileSize: mediaLimits.imageBytes } }),
  )
  replaceAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<AvatarResponseDto> {
    if (file === undefined) throw new ApiException(400, "BAD_REQUEST");
    return this.profile.replaceAvatar(session.userId, { buffer: file.buffer });
  }
}
