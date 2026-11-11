import { Readable } from "node:stream";
import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { VideoUploadController } from "../../src/catalog/video-upload.controller";
import type { VideoUploadService } from "../../src/catalog/video-upload.service";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

const params = {
  id: "0198f1a0-0000-7000-8000-0000000000c1",
  moduleId: "0198f1a0-0000-7000-8000-0000000000c2",
  videoId: "0198f1a0-0000-7000-8000-0000000000c3",
  assetKey: "a".repeat(32),
};

const build = () => {
  const service = {
    start: vi.fn().mockResolvedValue({ assetKey: params.assetKey, length: 100 }),
    position: vi.fn().mockResolvedValue({ offset: 40, length: 100 }),
    append: vi.fn().mockResolvedValue({ offset: 70, length: 100 }),
  };
  const headers: Record<string, string> = {};
  const response = { setHeader: (name: string, value: string) => (headers[name] = value) };
  const controller = new VideoUploadController(service as unknown as VideoUploadService);
  return { controller, service, headers, response };
};

const requestOf = (headers: Record<string, string>) =>
  Object.assign(Readable.from([Buffer.alloc(0)]), {
    headers,
    ip: "10.0.0.1",
    authSession: { userId: "admin-1" },
  }) as never;

describe("VideoUploadController guards", () => {
  test("is admin only, role restricted and rate limited on every route", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, VideoUploadController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, VideoUploadController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
    for (const method of ["create", "head", "patch"] as const) {
      expect(
        Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, VideoUploadController) ??
          Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, VideoUploadController.prototype[method]),
      ).toBe("videoUpload");
    }
  });

  test("only the start is audited so chunk requests hold no transaction", () => {
    expect(Reflect.getMetadata(AUDITED_KEY, VideoUploadController.prototype.create)).toEqual({
      action: "video-upload.start",
      entity: "VideoAsset",
    });
    expect(Reflect.getMetadata(AUDITED_KEY, VideoUploadController.prototype.patch)).toBeUndefined();
    expect(Reflect.getMetadata(AUDITED_KEY, VideoUploadController.prototype.head)).toBeUndefined();
  });
});

describe("VideoUploadController tus responses", () => {
  test("create answers with the location of the upload by asset key and offset zero", async () => {
    const { controller, service, headers, response } = build();
    await controller.create(
      params,
      requestOf({ "tus-resumable": "1.0.0", "upload-length": "100" }),
      response,
    );
    expect(service.start).toHaveBeenCalledWith(
      { courseId: params.id, moduleId: params.moduleId, videoId: params.videoId },
      { version: "1.0.0", length: "100" },
    );
    expect(headers.Location).toBe(
      `/api/admin/courses/${params.id}/modules/${params.moduleId}/videos/${params.videoId}/upload/${params.assetKey}`,
    );
    expect(headers["Upload-Offset"]).toBe("0");
    expect(headers["Tus-Resumable"]).toBe("1.0.0");
    expect(headers["Cache-Control"]).toBe("no-store");
  });

  test("head reports the server offset and length", async () => {
    const { controller, headers, response } = build();
    await controller.head(params, requestOf({ "tus-resumable": "1.0.0" }), response);
    expect(headers["Upload-Offset"]).toBe("40");
    expect(headers["Upload-Length"]).toBe("100");
  });

  test("patch hands the stream and headers to the service and returns the new offset", async () => {
    const { controller, service, headers, response } = build();
    const request = requestOf({
      "tus-resumable": "1.0.0",
      "content-type": "application/offset+octet-stream",
      "upload-offset": "40",
    });
    await controller.patch(params, request, response);
    const [, , appended, actor] = service.append.mock.calls[0] as [
      unknown,
      unknown,
      { version: string; contentType: string; offset: string; body: unknown },
      { actorId: string },
    ];
    expect(appended).toMatchObject({
      version: "1.0.0",
      contentType: "application/offset+octet-stream",
      offset: "40",
    });
    expect(appended.body).toBe(request);
    expect(actor.actorId).toBe("admin-1");
    expect(headers["Upload-Offset"]).toBe("70");
  });
});
