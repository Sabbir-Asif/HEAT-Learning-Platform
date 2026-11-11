import { Readable } from "node:stream";
import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { ApiException } from "../../src/http/api-exception";
import { VideoUploadService } from "../../src/catalog/video-upload.service";
import type { UploadState, UploadStore } from "../../src/catalog/video-upload-store";

const slot = {
  courseId: "0198f1a0-0000-7000-8000-0000000000c1",
  moduleId: "m",
  videoId: "v",
};
const actor = { actorId: "admin-1", ipAddress: "10.0.0.1", requestId: "req-1" };
const startedAt = new Date("2026-11-11T06:00:00.000Z");
const version = "1.0.0";
const contentType = "application/offset+octet-stream";
const key = "k".repeat(32);

const mp4Header = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypisom"),
  Buffer.alloc(12),
]);

class MemoryStore implements UploadStore {
  readonly files = new Map<
    string,
    { length: number; data: Buffer; createdAt: Date; complete: boolean }
  >();
  discarded: string[] = [];

  create(storeKey: string, length: number, createdAt: Date): Promise<void> {
    this.files.set(storeKey, { length, data: Buffer.alloc(0), createdAt, complete: false });
    return Promise.resolve();
  }

  state(storeKey: string): Promise<UploadState | null> {
    const file = this.files.get(storeKey);
    if (file === undefined) return Promise.resolve(null);
    return Promise.resolve({
      length: file.length,
      offset: file.complete ? file.length : file.data.length,
      createdAt: file.createdAt,
      complete: file.complete,
    });
  }

  async append(storeKey: string, source: Readable, room: number): Promise<number> {
    const file = this.files.get(storeKey);
    if (file === undefined) throw new Error("missing");
    for await (const chunk of source) {
      const bytes = Buffer.from(chunk as Buffer);
      if (bytes.length > room) throw new ApiException(413, "UPLOAD_TOO_LARGE");
      file.data = Buffer.concat([file.data, bytes]);
      room -= bytes.length;
    }
    return file.data.length;
  }

  head(storeKey: string, size: number): Promise<Buffer> {
    return Promise.resolve(this.files.get(storeKey)?.data.subarray(0, size) ?? Buffer.alloc(0));
  }

  complete(storeKey: string): Promise<void> {
    const file = this.files.get(storeKey);
    if (file !== undefined) file.complete = true;
    return Promise.resolve();
  }

  discard(storeKey: string): Promise<void> {
    this.discarded.push(storeKey);
    this.files.delete(storeKey);
    return Promise.resolve();
  }
}

interface Options {
  lockedAt?: Date | null;
  slotAsset?: { id: string; status: string } | null;
  now?: Date;
}

const build = (options: Options = {}) => {
  const store = new MemoryStore();
  const asset =
    options.slotAsset === undefined ? { id: "asset-1", status: "UPLOADING" } : options.slotAsset;
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt: options.lockedAt ?? null }]),
    $transaction: vi.fn().mockImplementation((run: (tx: unknown) => unknown) => run(database)),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt: options.lockedAt ?? null,
        revisions: [{ id: "rev" }],
      }),
    },
    module: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === "m" ? { id: "m" } : null),
        ),
    },
    video: {
      findFirst: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { id: string; asset?: { assetKey: string } } }) => {
            if (where.id !== "v") return Promise.resolve(null);
            if (where.asset === undefined) return Promise.resolve({ assetId: "old-asset" });
            return Promise.resolve(where.asset.assetKey === key ? { asset } : null);
          },
        ),
      update: vi.fn().mockResolvedValue({}),
    },
    videoAsset: {
      create: vi.fn().mockResolvedValue({ id: "asset-new" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    outbox: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const clock = { now: () => options.now ?? startedAt };
  const config = { videoUploads: { directory: "/unused", expiryHours: 24 } };
  const random = (size: number) => Buffer.alloc(size, 0xab);
  const service = new VideoUploadService(
    database as never,
    new AuditService({} as never),
    config as never,
    clock,
    store,
    random,
  );
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, store, changes, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

const expectFailure = async (promise: Promise<unknown>, status: number, code: string) => {
  const error = await failureOf(promise);
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).getStatus()).toBe(status);
  expect((error as ApiException).code).toBe(code);
};

const chunk = (...parts: Buffer[]) => Readable.from(parts);

const append = (
  service: VideoUploadService,
  offset: string,
  body: Readable,
  overrides: { contentType?: string; version?: string } = {},
) =>
  service.append(
    slot,
    key,
    {
      version: overrides.version ?? version,
      contentType: overrides.contentType ?? contentType,
      offset,
      body,
    },
    actor,
  );

describe("VideoUploadService.start", () => {
  test("creates an UPLOADING asset under a server chosen key and attaches it to the slot", async () => {
    const { service, database, store, changes, inAuditScope } = build();
    const result = await inAuditScope(() => service.start(slot, { version, length: "5000" }));
    const expectedKey = Buffer.alloc(24, 0xab).toString("base64url");
    expect(result).toEqual({ assetKey: expectedKey, length: 5000 });
    expect(database.videoAsset.create.mock.calls[0]?.[0].data).toEqual({
      assetKey: expectedKey,
      status: "UPLOADING",
      referenceCount: 1,
    });
    expect(database.video.update).toHaveBeenCalledWith({
      where: { id: "v" },
      data: { assetId: "asset-new" },
    });
    expect(store.files.get(expectedKey)?.length).toBe(5000);
    expect(changes).toHaveLength(1);
  });

  test("releases the asset the slot pointed to before", async () => {
    const { service, database, inAuditScope } = build();
    await inAuditScope(() => service.start(slot, { version, length: "5000" }));
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "old-asset", referenceCount: { gt: 0 } },
      data: { referenceCount: { decrement: 1 } },
    });
  });

  test("refuses a locked course with the content lock error and writes nothing", async () => {
    const { service, database, store, inAuditScope } = build({ lockedAt: startedAt });
    await expectFailure(
      inAuditScope(() => service.start(slot, { version, length: "5000" })),
      409,
      "CONTENT_LOCKED",
    );
    expect(database.videoAsset.create).not.toHaveBeenCalled();
    expect(store.files.size).toBe(0);
  });

  test("refuses a file over the size cap before any database work", async () => {
    const { service, database, inAuditScope } = build();
    await expectFailure(
      inAuditScope(() => service.start(slot, { version, length: String(2 * 1024 ** 3 + 1) })),
      413,
      "UPLOAD_TOO_LARGE",
    );
    expect(database.$queryRaw).not.toHaveBeenCalled();
  });

  test("answers 404 for a module outside the course or a slot that is not there", async () => {
    const { service, inAuditScope } = build();
    await expectFailure(
      inAuditScope(() =>
        service.start({ ...slot, moduleId: "other" }, { version, length: "5000" }),
      ),
      404,
      "NOT_FOUND",
    );
    await expectFailure(
      inAuditScope(() => service.start({ ...slot, videoId: "gone" }, { version, length: "5000" })),
      404,
      "NOT_FOUND",
    );
  });

  test("requires the tus protocol version", async () => {
    const { service, inAuditScope } = build();
    await expectFailure(
      inAuditScope(() => service.start(slot, { version: undefined, length: "5000" })),
      412,
      "BAD_REQUEST",
    );
  });
});

describe("VideoUploadService.position and append", () => {
  const started = async (options: Options = {}, length = 40) => {
    const built = build(options);
    await built.store.create(key, length, startedAt);
    return built;
  };

  test("reports the offset the server holds", async () => {
    const { service, store } = await started();
    await append(service, "0", chunk(mp4Header));
    expect(await service.position(slot, key, version)).toEqual({ offset: 24, length: 40 });
    expect(store.files.get(key)?.data.length).toBe(24);
  });

  test("resumes from the last confirmed offset after a dropped connection", async () => {
    const { service } = await started();
    await append(service, "0", chunk(mp4Header.subarray(0, 14)));
    const resumeAt = (await service.position(slot, key, version)).offset;
    expect(resumeAt).toBe(14);
    const result = await append(service, String(resumeAt), chunk(mp4Header.subarray(14)));
    expect(result.offset).toBe(24);
  });

  test("a patch that does not start at the server offset conflicts", async () => {
    const { service } = await started();
    await append(service, "0", chunk(mp4Header));
    await expectFailure(
      append(service, "10", chunk(Buffer.alloc(4))),
      409,
      "UPLOAD_OFFSET_MISMATCH",
    );
  });

  test("a patch with the wrong content type or version is refused", async () => {
    const { service } = await started();
    await expectFailure(
      append(service, "0", chunk(mp4Header), { contentType: "video/mp4" }),
      415,
      "UPLOAD_TYPE_NOT_ALLOWED",
    );
    await expectFailure(
      append(service, "0", chunk(mp4Header), { version: "0.2.2" }),
      412,
      "BAD_REQUEST",
    );
  });

  test("content that is not a video is discarded and the asset becomes REJECTED", async () => {
    const { service, store, database } = await started();
    await expectFailure(
      append(service, "0", chunk(Buffer.from("%PDF-1.7 this is a document"))),
      415,
      "UPLOAD_TYPE_NOT_ALLOWED",
    );
    expect(store.discarded).toEqual([key]);
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "asset-1", status: "UPLOADING" },
      data: { status: "REJECTED" },
    });
    expect(database.outbox.create).not.toHaveBeenCalled();
  });

  test("the signature is judged once enough bytes have arrived, across small chunks", async () => {
    const { service, store } = await started();
    await append(service, "0", chunk(Buffer.from("%PDF")));
    expect(store.discarded).toEqual([]);
    await expectFailure(
      append(service, "4", chunk(Buffer.from("-1.7 and more"))),
      415,
      "UPLOAD_TYPE_NOT_ALLOWED",
    );
    expect(store.discarded).toEqual([key]);
  });

  test("a body longer than the declared length is refused", async () => {
    const { service } = await started({}, 24);
    await expectFailure(
      append(service, "0", chunk(Buffer.concat([mp4Header, Buffer.alloc(1)]))),
      413,
      "UPLOAD_TOO_LARGE",
    );
  });

  test("the last byte completes the upload: UPLOADED, one outbox event and an audit entry", async () => {
    const { service, store, database } = await started({}, 24);
    const result = await append(service, "0", chunk(mp4Header));
    expect(result).toEqual({ offset: 24, length: 24 });
    expect(store.files.get(key)?.complete).toBe(true);
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: "asset-1", status: "UPLOADING" },
      data: { status: "UPLOADED" },
    });
    expect(database.outbox.create).toHaveBeenCalledTimes(1);
    expect(database.outbox.create).toHaveBeenCalledWith({
      data: { eventType: "video.uploaded", payload: { assetId: "asset-1" } },
    });
    const entry = database.auditLog.create.mock.calls[0]?.[0].data;
    expect(entry).toMatchObject({
      action: "video-upload.complete",
      entity: "VideoAsset",
      entityId: "asset-1",
      actorId: "admin-1",
    });
  });

  test("a second completion does not enqueue a second job", async () => {
    const { service, database } = await started({}, 24);
    database.videoAsset.updateMany.mockResolvedValue({ count: 0 });
    await append(service, "0", chunk(mp4Header));
    expect(database.outbox.create).not.toHaveBeenCalled();
  });

  test("refuses to write into a course that was locked after the upload began", async () => {
    const { service, store } = await started({ lockedAt: startedAt });
    await expectFailure(append(service, "0", chunk(mp4Header)), 409, "CONTENT_LOCKED");
    expect(store.files.get(key)?.data.length).toBe(0);
  });

  test("an upload that was never finished expires and is left for the cleanup job", async () => {
    const { service, store } = await started({ now: new Date("2026-11-12T06:00:01.000Z") });
    await expectFailure(append(service, "0", chunk(mp4Header)), 410, "UPLOAD_EXPIRED");
    await expectFailure(service.position(slot, key, version), 410, "UPLOAD_EXPIRED");
    expect(store.discarded).toEqual([]);
    expect(store.files.has(key)).toBe(true);
  });

  test("a finished upload never expires and cannot be written again", async () => {
    const { service } = await started({
      slotAsset: { id: "asset-1", status: "UPLOADED" },
      now: new Date("2026-12-01T00:00:00.000Z"),
    });
    await service["store"].append(key, chunk(mp4Header), 40);
    await service["store"].complete(key);
    expect(await service.position(slot, key, version)).toEqual({ offset: 40, length: 40 });
    await expectFailure(
      append(service, "40", chunk(Buffer.alloc(1))),
      409,
      "UPLOAD_OFFSET_MISMATCH",
    );
  });

  test("an upload key that is not the slot's current asset is not found", async () => {
    const { service } = await started();
    await expectFailure(
      service.append(
        slot,
        "z".repeat(32),
        { version, contentType, offset: "0", body: chunk(mp4Header) },
        actor,
      ),
      404,
      "NOT_FOUND",
    );
    await expectFailure(
      service.position({ ...slot, videoId: "other" }, key, version),
      404,
      "NOT_FOUND",
    );
  });

  test("a rejected asset is not found", async () => {
    const { service } = await started({ slotAsset: { id: "asset-1", status: "REJECTED" } });
    await expectFailure(service.position(slot, key, version), 404, "NOT_FOUND");
  });

  test("two writers on the same upload cannot interleave", async () => {
    const { service } = await started();
    const slow = new Readable({ read() {} });
    const first = append(service, "0", slow);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await expectFailure(append(service, "0", chunk(mp4Header)), 409, "UPLOAD_OFFSET_MISMATCH");
    slow.push(mp4Header);
    slow.push(null);
    expect((await first).offset).toBe(24);
  });
});
