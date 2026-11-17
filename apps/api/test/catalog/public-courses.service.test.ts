import { describe, expect, test, vi } from "vitest";
import { ApiException } from "../../src/http/api-exception";
import { PublicCoursesService } from "../../src/catalog/public-courses.service";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "c1",
  slug: "safety",
  title: "Safety",
  description: "About",
  thumbnailAssetId: "t1",
  revisions: [
    {
      modules: [
        { id: "m1", order: 1, title: "One", objectives: ["a"] },
        { id: "m2", order: 2, title: "Two", objectives: [] },
      ],
    },
  ],
  ...overrides,
});

const build = (course: unknown, images = new Map()) => {
  const findFirst = vi.fn().mockResolvedValue(course);
  const resolve = vi.fn().mockResolvedValue(images);
  const service = new PublicCoursesService(
    { course: { findFirst } } as never,
    { resolve } as never,
  );
  return { service, findFirst, resolve };
};

describe("PublicCoursesService.get", () => {
  test("looks up only published, undeleted courses and published revisions", async () => {
    const { service, findFirst } = build(row());

    await service.get("safety");

    const query = findFirst.mock.calls[0]?.[0];
    expect(query.where).toEqual({ slug: "safety", deletedAt: null, status: "PUBLISHED" });
    expect(query.select.revisions.where).toEqual({
      deletedAt: null,
      publishedAt: { not: null },
    });
    expect(query.select.revisions.select.modules.where).toEqual({ deletedAt: null });
  });

  test("answers not found for a draft, deleted or unknown slug", async () => {
    const { service } = build(null);

    const error = await service.get("missing").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe("NOT_FOUND");
  });

  test("returns the course with its modules in order and the resolved thumbnail", async () => {
    const image = { assetId: "t1", url: "/media/public/x/w640.webp", alt: "Cover" };
    const { service } = build(row(), new Map([["t1", image]]));

    const result = await service.get("safety");

    expect(result.thumbnail).toEqual(image);
    expect(result.modules.map((module) => module.id)).toEqual(["m1", "m2"]);
    expect(result.description).toBe("About");
  });

  test("returns no thumbnail when the asset is not public and no modules without a revision", async () => {
    const { service } = build(row({ revisions: [] }));

    const result = await service.get("safety");

    expect(result.thumbnail).toBeNull();
    expect(result.modules).toEqual([]);
  });
});
