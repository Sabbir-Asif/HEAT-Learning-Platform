import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { MediaService } from "../../src/media/media.service";
import { ResourcesService } from "../../src/resources/resources.service";

const resourceId = "0198f1a0-0000-7000-8000-0000000000e1";
const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
const otherAssetId = "0198f1a0-0000-7000-8000-0000000000a2";
const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const now = new Date("2026-11-12T06:00:00.000Z");

const asset = (id: string) => ({
  id,
  key: "public/2026/11/abc",
  kind: "DOCUMENT",
  visibility: "PUBLIC",
  mimeType: "application/pdf",
  sizeBytes: 1000,
  width: null,
  height: null,
  altText: null,
  variants: [],
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: resourceId,
  kind: "LINK",
  title: "Guide",
  description: null,
  url: "https://example.org/guide",
  mediaAssetId: null,
  courseId: null,
  displayOrder: 0,
  published: false,
  createdAt: now,
  updatedAt: now,
  course: null,
  mediaAsset: null,
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) => ({
  kind: "link" as const,
  title: "Guide",
  description: null,
  url: "https://example.org/guide",
  mediaAssetId: null,
  courseId: null,
  displayOrder: 0,
  published: false,
  ...overrides,
});

const build = (options: { existing?: unknown; courseActive?: boolean; assetOk?: boolean } = {}) => {
  const database = {
    resource: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.existing === undefined ? row() : options.existing),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: resourceId }),
      update: vi.fn().mockResolvedValue(undefined),
    },
    mediaAsset: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.assetOk === false
            ? null
            : { id: assetId, mimeType: "application/pdf", linkedEntity: null, linkedId: null },
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const media = new MediaService(
    database as never,
    {} as never,
    {} as never,
    { now: () => now },
    (() => "id") as never,
    {} as never,
    new AuditService({} as never),
  );
  const service = new ResourcesService(
    database as never,
    { now: () => now },
    new AuditService({} as never),
    media,
    {
      describe: vi.fn().mockReturnValue({ url: "/media/public/2026/11/abc/original.pdf" }),
    } as never,
    { isActive: vi.fn().mockResolvedValue(options.courseActive ?? true) } as never,
    { revalidate } as never,
  );
  const changes: AuditChange[] = [];
  const afterCommit: Array<() => Promise<void>> = [];
  const scope = { tx: database as never, changes, afterCommit, skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, afterCommit, revalidate, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("ResourcesService.create", () => {
  test("saves a link, audits it and revalidates the resources tag", async () => {
    const { service, database, changes, afterCommit, revalidate, inAuditScope } = build();
    await inAuditScope(() => service.create(request()));
    expect(database.resource.create.mock.calls[0]?.[0].data).toMatchObject({
      kind: "LINK",
      url: "https://example.org/guide",
      published: false,
    });
    expect(changes[0]?.after).toMatchObject({ kind: "link", title: "Guide" });
    await afterCommit[0]?.();
    expect(revalidate).toHaveBeenCalledWith(["resources"]);
  });

  test("links an uploaded public document to the resource", async () => {
    const { service, database, inAuditScope } = build({
      existing: row({ kind: "FILE", url: null, mediaAssetId: assetId, mediaAsset: asset(assetId) }),
    });
    const result = await inAuditScope(() =>
      service.create(request({ kind: "file", url: null, mediaAssetId: assetId })),
    );
    expect(database.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { linkedEntity: "Resource", linkedId: resourceId } }),
    );
    expect(result.file).toMatchObject({ assetId, sizeBytes: 1000 });
  });

  test("rejects a file that is not a usable public document", async () => {
    const { service, database, inAuditScope } = build({ assetOk: false });
    const error = await failureOf(
      inAuditScope(() =>
        service.create(request({ kind: "file", url: null, mediaAssetId: assetId })),
      ),
    );
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(database.mediaAsset.updateMany).not.toHaveBeenCalled();
  });

  test("rejects a course that does not exist", async () => {
    const { service, database, inAuditScope } = build({ courseActive: false });
    const error = await failureOf(inAuditScope(() => service.create(request({ courseId }))));
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(database.resource.create).not.toHaveBeenCalled();
  });
});

describe("ResourcesService.update and remove", () => {
  test("releases the previous file when it is replaced", async () => {
    const { service, database, inAuditScope } = build({
      existing: row({ kind: "FILE", url: null, mediaAssetId: otherAssetId }),
    });
    await inAuditScope(() =>
      service.update(resourceId, request({ kind: "file", url: null, mediaAssetId: assetId })),
    );
    expect(database.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: otherAssetId, linkedEntity: "Resource", linkedId: resourceId },
      data: { linkedEntity: null, linkedId: null },
    });
  });

  test("returns not found for a missing resource", async () => {
    const { service, inAuditScope } = build({ existing: null });
    const error = await failureOf(inAuditScope(() => service.update(resourceId, request())));
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  test("soft deletes, unpublishes and releases the file for cleanup", async () => {
    const { service, database, changes, inAuditScope } = build({
      existing: row({ kind: "FILE", url: null, mediaAssetId: assetId, published: true }),
    });
    await inAuditScope(() => service.remove(resourceId));
    expect(database.resource.update).toHaveBeenCalledWith({
      where: { id: resourceId },
      data: { deletedAt: now, mediaAssetId: null, published: false },
    });
    expect(database.mediaAsset.updateMany).toHaveBeenCalledWith({
      where: { id: assetId, linkedEntity: "Resource", linkedId: resourceId },
      data: { linkedEntity: null, linkedId: null },
    });
    expect(changes[0]?.before).toMatchObject({ published: true });
  });
});
