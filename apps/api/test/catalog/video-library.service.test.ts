import { describe, expect, test, vi } from "vitest";
import { VideoLibraryService, videoLibraryWhere } from "../../src/catalog/video-library.service";

const query = { sort: "-statusChangedAt" as const, page: 2, pageSize: 10 };

describe("videoLibraryWhere", () => {
  test("lists uploaded videos only and skips deleted slots and modules", () => {
    expect(videoLibraryWhere(query)).toEqual({
      deletedAt: null,
      assetId: { not: null },
      module: { deletedAt: null },
    });
  });

  test("filters by asset status and by course", () => {
    expect(videoLibraryWhere({ ...query, status: "FAILED", courseId: "course" })).toEqual({
      deletedAt: null,
      assetId: { not: null },
      asset: { is: { status: "FAILED" } },
      module: { deletedAt: null, revision: { courseId: "course" } },
    });
  });
});

describe("VideoLibraryService.list", () => {
  const row = {
    id: "video-id",
    title: "Welcome",
    asset: {
      status: "FAILED",
      rejectionReason: null,
      failureReason: "TIMED_OUT",
      createdAt: new Date("2026-11-11T06:00:00.000Z"),
      updatedAt: new Date("2026-11-11T06:05:00.000Z"),
    },
    module: {
      id: "module-id",
      title: "Module 1",
      revision: { course: { id: "course-id", title: "HEAT" } },
    },
  };

  const build = (rows: unknown[], total: number) => {
    const video = {
      findMany: vi.fn().mockResolvedValue(rows),
      count: vi.fn().mockResolvedValue(total),
    };
    return { video, service: new VideoLibraryService({ video } as never) };
  };

  test("pages on the server and maps rows", async () => {
    const { video, service } = build([row], 11);

    const result = await service.list(query);

    expect(video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: [{ asset: { updatedAt: "desc" } }, { id: "asc" }],
      }),
    );
    expect(result).toEqual({
      items: [
        {
          id: "video-id",
          title: "Welcome",
          status: "FAILED",
          rejectionReason: null,
          failureReason: "TIMED_OUT",
          uploadedAt: "2026-11-11T06:00:00.000Z",
          statusChangedAt: "2026-11-11T06:05:00.000Z",
          course: { id: "course-id", title: "HEAT" },
          module: { id: "module-id", title: "Module 1" },
        },
      ],
      total: 11,
      page: 2,
      pageSize: 10,
    });
  });

  test("hides a stored reason that is not a known code", async () => {
    const { service } = build([{ ...row, asset: { ...row.asset, failureReason: "legacy" } }], 1);

    expect((await service.list(query)).items[0]?.failureReason).toBeNull();
  });

  test("sorts by title", async () => {
    const { video, service } = build([], 0);

    await service.list({ ...query, sort: "title" });

    expect(video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ title: "asc" }, { id: "asc" }] }),
    );
  });
});
