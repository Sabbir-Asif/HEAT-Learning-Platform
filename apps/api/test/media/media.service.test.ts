import { describe, expect, test } from "vitest";
import type { MediaStorage } from "../../src/core";
import type { AuditService } from "../../src/audit";
import type { AppConfig } from "../../src/core";
import { ApiException } from "../../src/http/api-exception";
import type { ImageProcessor } from "../../src/media/image-processor";
import { MediaService } from "../../src/media/media.service";
import { MediaUrlService } from "../../src/media/media-url.service";

const now = new Date("2026-11-12T00:00:00.000Z");
const uploaderId = "0194f3a0-0000-7000-8000-000000000001";
const otherId = "0194f3a0-0000-7000-8000-000000000002";
const assetId = "0194f3a0-0000-7000-8000-0000000000bb";
const fileId = "0194f3a0-0000-7000-8000-0000000000cc";

interface Row {
  id: string;
  key: string;
  uploaderId: string;
  visibility: "PUBLIC" | "PROTECTED" | "PRIVATE";
  variants: unknown;
  [field: string]: unknown;
}

const setup = () => {
  const rows: Row[] = [];
  const written: string[] = [];
  const removed: string[] = [];
  const storage: MediaStorage = {
    write: async (key, file) => {
      written.push(`${key}/${file}`);
    },
    removeAsset: async (key) => {
      removed.push(key);
    },
    pathOf: (key, file) => `${key}/${file}`,
  };
  const processor: ImageProcessor = {
    process: async () => ({
      width: 640,
      height: 480,
      files: [
        {
          name: "w640",
          file: "w640.webp",
          format: "webp",
          width: 640,
          height: 480,
          bytes: Buffer.alloc(5),
        },
      ],
    }),
  };
  const database = {
    mediaAsset: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: assetId, createdAt: now, kind: "IMAGE", ...data } as unknown as Row;
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        rows.find((row) => row.id === where.id) ?? null,
      delete: async ({ where }: { where: { id: string } }) => {
        rows.splice(0, rows.length, ...rows.filter((row) => row.id !== where.id));
      },
    },
  };
  const audit = { capture: () => undefined } as unknown as AuditService;
  const urls = new MediaUrlService({ hls: undefined } as AppConfig, { now: () => now });
  const service = new MediaService(
    database as never,
    storage,
    processor,
    { now: () => now },
    () => fileId,
    urls,
    audit,
  );
  return { service, rows, written, removed };
};

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16),
]);
const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(16)]);

const codeOf = async (run: () => Promise<unknown>): Promise<string | undefined> => {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiException) return error.code;
    throw error;
  }
  return undefined;
};

describe("MediaService.upload", () => {
  test("rejects a PNG uploaded as a document and writes nothing", async () => {
    const { service, written } = setup();

    const code = await codeOf(() =>
      service.upload(
        uploaderId,
        { buffer: png },
        { kind: "document", visibility: "public", crop: "none" },
      ),
    );

    expect(code).toBe("UPLOAD_TYPE_NOT_ALLOWED");
    expect(written).toEqual([]);
  });

  test("rejects SVG content whatever the declared kind", async () => {
    const { service } = setup();
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

    for (const kind of ["image", "document"] as const) {
      const code = await codeOf(() =>
        service.upload(
          uploaderId,
          { buffer: svg },
          { kind, visibility: "public", altText: "x", crop: "none" },
        ),
      );
      expect(code).toBe("UPLOAD_TYPE_NOT_ALLOWED");
    }
  });

  test("requires alt text for content images", async () => {
    const { service } = setup();

    const code = await codeOf(() =>
      service.upload(
        uploaderId,
        { buffer: png },
        { kind: "image", visibility: "public", crop: "none" },
      ),
    );

    expect(code).toBe("VALIDATION_FAILED");
  });

  test("stores the processed variants under a random key and links no entity", async () => {
    const { service, rows, written } = setup();

    const result = await service.upload(
      uploaderId,
      { buffer: png },
      { kind: "image", visibility: "public", altText: "A hall", crop: "none" },
    );

    expect(written).toEqual([`public/2026/11/${fileId}/w640.webp`]);
    expect(rows[0]?.key).toBe(`public/2026/11/${fileId}`);
    expect(rows[0]?.linkedEntity).toBeUndefined();
    expect(result.url).toBe(`/media/public/2026/11/${fileId}/w640.webp`);
  });

  test("stores a document as-is with its own extension", async () => {
    const { service, written } = setup();

    await service.upload(
      uploaderId,
      { buffer: pdf },
      { kind: "document", visibility: "private", crop: "none" },
    );

    expect(written).toEqual([`private/2026/11/${fileId}/original.pdf`]);
  });
});

describe("MediaService.privateFile and release", () => {
  const upload = async () => {
    const context = setup();
    await context.service.upload(
      uploaderId,
      { buffer: pdf },
      { kind: "document", visibility: "private", crop: "none" },
    );
    return context;
  };

  test("the owner and an admin get an internal redirect, another student gets 403", async () => {
    const { service } = await upload();

    await expect(
      service.privateFile(assetId, "original.pdf", { userId: uploaderId, admin: false }),
    ).resolves.toEqual({
      internalPath: `/internal/media/private/2026/11/${fileId}/original.pdf`,
      mimeType: "application/pdf",
    });
    await expect(
      service.privateFile(assetId, "original.pdf", { userId: otherId, admin: true }),
    ).resolves.toBeDefined();
    expect(
      await codeOf(() =>
        service.privateFile(assetId, "original.pdf", { userId: otherId, admin: false }),
      ),
    ).toBe("FORBIDDEN");
  });

  test("a file name outside the stored variants is not found", async () => {
    const { service } = await upload();

    expect(
      await codeOf(() =>
        service.privateFile(assetId, "secret.pdf", { userId: uploaderId, admin: false }),
      ),
    ).toBe("NOT_FOUND");
  });

  test("release removes the row and its files", async () => {
    const { service, rows, removed } = await upload();

    await service.release(assetId);

    expect(rows).toEqual([]);
    expect(removed).toEqual([`private/2026/11/${fileId}`]);
  });
});
