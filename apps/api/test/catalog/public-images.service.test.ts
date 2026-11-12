import { describe, expect, test, vi } from "vitest";
import { PublicImagesService } from "../../src/catalog/public-images.service";

const asset = (id: string, altText: string | null) => ({ id, altText });

const build = (assets: ReturnType<typeof asset>[]) => {
  const findMany = vi.fn().mockResolvedValue(assets);
  const describe = vi.fn((record: { id: string }) => ({
    url: `/media/public/${record.id}/w640.webp`,
  }));
  const service = new PublicImagesService(
    { mediaAsset: { findMany } } as never,
    { describe } as never,
  );
  return { service, findMany };
};

describe("PublicImagesService.resolve", () => {
  test("skips the query when there are no ids", async () => {
    const { service, findMany } = build([]);

    const result = await service.resolve([null, null]);

    expect(result.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  test("queries distinct ids and only public, undeleted images", async () => {
    const { service, findMany } = build([]);

    await service.resolve(["a", "a", null, "b"]);

    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      id: { in: ["a", "b"] },
      deletedAt: null,
      kind: "IMAGE",
      visibility: "PUBLIC",
    });
  });

  test("maps each asset to its url and alt text, empty when none is set", async () => {
    const { service } = build([asset("a", "Cover"), asset("b", null)]);

    const result = await service.resolve(["a", "b"]);

    expect(result.get("a")).toEqual({
      assetId: "a",
      url: "/media/public/a/w640.webp",
      alt: "Cover",
    });
    expect(result.get("b")?.alt).toBe("");
  });
});
