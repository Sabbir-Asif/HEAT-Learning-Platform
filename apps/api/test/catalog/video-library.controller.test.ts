import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { VideoLibraryController } from "../../src/catalog/video-library.controller";

describe("VideoLibraryController", () => {
  test("is limited to the admin audience and admin roles", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, VideoLibraryController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, VideoLibraryController)).toEqual([
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  test("lists through the service", async () => {
    const list = vi.fn().mockResolvedValue({ items: [] });

    await new VideoLibraryController({ list } as never).list({ page: 1 } as never);

    expect(list).toHaveBeenCalledWith({ page: 1 });
  });

  test("never lets shared caches keep the response", () => {
    expect(
      Reflect.getMetadata("__headers__", VideoLibraryController.prototype.list),
    ).toContainEqual({ name: "Cache-Control", value: "no-store" });
  });
});
