import { Inject, Injectable } from "@nestjs/common";
import { avatarDisplayWidth, mediaImageUrl } from "@heat/contracts";
import type { AvatarResponse, ProfileResponse, UpdateProfileRequest } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { DepartmentOfferingService } from "../directory";
import { ApiException } from "../http/api-exception";
import { MediaService, MediaUrlService } from "../media";
import type { UploadedFile } from "../media/media.service";
import { assertProfileEditable, avatarEntity, isProfileLocked } from "./profile-rules";

const profileSelect = {
  id: true,
  name: true,
  session: true,
  user: { select: { email: true, emailVerifiedAt: true } },
  department: {
    select: {
      id: true,
      name: true,
      universityFaculty: {
        select: {
          university: { select: { id: true, name: true } },
          faculty: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class ProfileService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly departments: DepartmentOfferingService,
    private readonly media: MediaService,
    private readonly urls: MediaUrlService,
    private readonly audit: AuditService,
  ) {}

  async describe(userId: string): Promise<ProfileResponse> {
    const profile = await this.load(userId);
    return this.present(profile, await this.isLocked(userId), await this.avatarUrl(profile.id));
  }

  async update(userId: string, request: UpdateProfileRequest): Promise<ProfileResponse> {
    const profile = await this.load(userId);
    assertProfileEditable(await this.isLocked(userId));
    await this.departments.assertDepartmentOfferable(request.departmentId, this.database, {
      universityId: request.universityId,
      facultyId: request.facultyId,
    });
    await this.database.studentProfile.update({
      where: { id: profile.id },
      data: { name: request.name, departmentId: request.departmentId, session: request.session },
    });
    this.audit.capture({ entityId: profile.id });
    return this.describe(userId);
  }

  async replaceAvatar(userId: string, file: UploadedFile): Promise<AvatarResponse> {
    const profile = await this.load(userId);
    const previous = await this.database.mediaAsset.findMany({
      where: { linkedEntity: avatarEntity, linkedId: profile.id },
      select: { id: true },
    });
    const asset = await this.media.upload(
      userId,
      file,
      { kind: "image", visibility: "private", crop: "square" },
      "student",
    );
    await this.media.link(asset.id, avatarEntity, profile.id);
    for (const old of previous) await this.media.release(old.id);
    return { avatarUrl: mediaImageUrl(asset.url, avatarDisplayWidth) };
  }

  private async load(userId: string) {
    const profile = await this.database.studentProfile.findFirst({
      where: { userId, deletedAt: null },
      select: profileSelect,
    });
    if (profile === null) throw new ApiException(404, "NOT_FOUND");
    return profile;
  }

  private async isLocked(userId: string): Promise<boolean> {
    const approvals = await this.database.enrollmentDecision.count({
      where: { action: "APPROVE", enrollment: { userId } },
    });
    return isProfileLocked(approvals);
  }

  private async avatarUrl(profileId: string): Promise<string | null> {
    const asset = await this.database.mediaAsset.findFirst({
      where: { linkedEntity: avatarEntity, linkedId: profileId },
      orderBy: { createdAt: "desc" },
    });
    if (asset === null) return null;
    return mediaImageUrl(this.urls.describe(asset, "student").url, avatarDisplayWidth);
  }

  private present(
    profile: Awaited<ReturnType<ProfileService["load"]>>,
    locked: boolean,
    avatarUrl: string | null,
  ): ProfileResponse {
    const { university, faculty } = profile.department.universityFaculty;
    return {
      name: profile.name,
      email: profile.user.email,
      emailVerified: profile.user.emailVerifiedAt !== null,
      university,
      faculty,
      department: { id: profile.department.id, name: profile.department.name },
      session: profile.session,
      locked,
      avatarUrl,
    };
  }
}
