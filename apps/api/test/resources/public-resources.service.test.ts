import { describe, expect, test, vi } from "vitest";
import { PublicResourcesService } from "../../src/resources/public-resources.service";
import { publicWhere } from "../../src/resources/resource-rules";

const asset = {
  id: "0198f1a0-0000-7000-8000-0000000000a1",
  key: "public/2026/11/abc",
  kind: "DOCUMENT",
  visibility: "PUBLIC",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  width: null,
  height: null,
  altText: null,
  variants: [],
};

const build = (rows: unknown[]) => {
  const findMany = vi.fn().mockResolvedValue(rows);
  const service = new PublicResourcesService(
    { resource: { findMany } } as never,
    {
      describe: vi.fn().mockReturnValue({
        url: "/media/public/2026/11/abc/original.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      }),
    } as never,
  );
  return { service, findMany };
};

describe("PublicResourcesService.list", () => {
  test("queries only published, non-deleted resources with a public file", async () => {
    const { service, findMany } = build([]);
    await service.list();
    expect(findMany.mock.calls[0]?.[0].where).toBe(publicWhere);
    expect(publicWhere).toMatchObject({ deletedAt: null, published: true });
  });

  test("exposes a file with its type, size and public download address", async () => {
    const { service } = build([
      { id: "r1", kind: "FILE", title: "Slides", description: null, url: null, mediaAsset: asset },
    ]);
    const result = await service.list();
    expect(result.items).toEqual([
      {
        id: "r1",
        kind: "file",
        title: "Slides",
        description: null,
        url: "/media/public/2026/11/abc/original.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
    ]);
  });

  test("exposes a link with its address and no admin-only fields", async () => {
    const { service } = build([
      {
        id: "r2",
        kind: "LINK",
        title: "Guide",
        description: "Read",
        url: "https://example.org",
        mediaAsset: null,
      },
    ]);
    const [item] = (await service.list()).items;
    expect(item).toEqual({
      id: "r2",
      kind: "link",
      title: "Guide",
      description: "Read",
      url: "https://example.org",
      mimeType: null,
      sizeBytes: null,
    });
    expect(Object.keys(item ?? {})).not.toContain("published");
  });

  test("skips a file resource whose file is gone", async () => {
    const { service } = build([
      { id: "r3", kind: "FILE", title: "Lost", description: null, url: null, mediaAsset: null },
    ]);
    expect((await service.list()).items).toEqual([]);
  });
});
