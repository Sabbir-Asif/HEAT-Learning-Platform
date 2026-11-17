import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { ProfileService } from "../../src/me/profile.service";

const profileRow = {
  id: "profile-id",
  name: "Anne Smith",
  session: "2020-21",
  user: { email: "anne@example.test", emailVerifiedAt: null },
  department: {
    id: "department-id",
    name: "Physics",
    universityFaculty: {
      university: { id: "university-id", name: "University of Dhaka" },
      faculty: { id: "faculty-id", name: "Science" },
    },
  },
};

const request = {
  name: "Anne Jones",
  universityId: "university-id",
  facultyId: "faculty-id",
  departmentId: "department-id",
  session: "2021-22",
};

const build = (approvals: number, previousAssets: { id: string }[] = []) => {
  const database = {
    studentProfile: {
      findFirst: vi.fn().mockResolvedValue(profileRow),
      update: vi.fn().mockResolvedValue(profileRow),
    },
    enrollmentDecision: { count: vi.fn().mockResolvedValue(approvals) },
    mediaAsset: {
      findMany: vi.fn().mockResolvedValue(previousAssets),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  const departments = { assertDepartmentOfferable: vi.fn().mockResolvedValue(undefined) };
  const media = {
    upload: vi.fn().mockResolvedValue({ id: "new-asset", url: "/api/media/new-asset/w1280.webp" }),
    link: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { capture: vi.fn() };
  const service = new ProfileService(
    database as never,
    departments as never,
    media as never,
    {} as never,
    audit as never,
  );
  return { service, database, departments, media, audit };
};

describe("ProfileService.update", () => {
  test("saves the name and academic details of a student without an approval", async () => {
    const { service, database } = build(0);

    await service.update("user-id", request);

    expect(database.studentProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: { name: "Anne Jones", departmentId: "department-id", session: "2021-22" },
    });
  });

  test("refuses an approved student with the locked-field code and saves nothing", async () => {
    const { service, database } = build(1);

    await expect(service.update("user-id", request)).rejects.toMatchObject({
      code: "PROFILE_LOCKED",
    });
    expect(database.studentProfile.update).not.toHaveBeenCalled();
  });

  test("checks the department belongs to the chosen university and faculty", async () => {
    const { service, departments } = build(0);

    await service.update("user-id", request);

    expect(departments.assertDepartmentOfferable).toHaveBeenCalledWith(
      "department-id",
      expect.anything(),
      { universityId: "university-id", facultyId: "faculty-id" },
    );
  });
});

describe("ProfileService.replaceAvatar", () => {
  test("stores a private square image, links it and deletes the previous avatars", async () => {
    const { service, media } = build(0, [{ id: "old-1" }, { id: "old-2" }]);

    const result = await service.replaceAvatar("user-id", { buffer: Buffer.from("x") });

    expect(media.upload).toHaveBeenCalledWith(
      "user-id",
      expect.anything(),
      { kind: "image", visibility: "private", crop: "square" },
      "student",
    );
    expect(media.link).toHaveBeenCalledWith("new-asset", "StudentProfile", "profile-id");
    expect(media.release).toHaveBeenCalledWith("old-1");
    expect(media.release).toHaveBeenCalledWith("old-2");
    expect(result.avatarUrl).toBe("/api/media/new-asset/w320.webp");
  });

  test("keeps the previous avatar when the upload is rejected", async () => {
    const { service, media } = build(0, [{ id: "old-1" }]);
    media.upload.mockRejectedValue(new ApiException(415, "UPLOAD_TYPE_NOT_ALLOWED"));

    await expect(service.replaceAvatar("user-id", { buffer: Buffer.from("x") })).rejects.toThrow();
    expect(media.release).not.toHaveBeenCalled();
  });
});
