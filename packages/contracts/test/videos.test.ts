import { describe, expect, test } from "vitest";
import {
  createVideoSlotRequestSchema,
  updateVideoSlotRequestSchema,
  videoLibraryListQuerySchema,
  videoLibraryListResponseSchema,
  videoPollIntervalMs,
  videoSlotListResponseSchema,
  videoSlotStatusSchema,
  videoStatusIsFinal,
  videoQueuedEventType,
  videoFailureReasonSchema,
  videoRejectionReasonSchema,
  videoUploadLimits,
  videoUploadParamsSchema,
  videoUploadedPayloadSchema,
} from "../src";

describe("video slot requests", () => {
  test("a new slot is required by default", () => {
    expect(createVideoSlotRequestSchema.parse({ title: "  Welcome  " })).toEqual({
      title: "Welcome",
      required: true,
    });
  });

  test("a slot can be created as optional", () => {
    expect(createVideoSlotRequestSchema.parse({ title: "Extra", required: false }).required).toBe(
      false,
    );
  });

  test("a blank title is refused", () => {
    expect(createVideoSlotRequestSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  test("an update needs both the title and the flag", () => {
    expect(updateVideoSlotRequestSchema.safeParse({ title: "Welcome" }).success).toBe(false);
    expect(
      updateVideoSlotRequestSchema.safeParse({ title: "Welcome", required: false }).success,
    ).toBe(true);
  });
});

describe("video slot responses", () => {
  test("status adds a state for a slot without an uploaded video", () => {
    expect(videoSlotStatusSchema.parse("NOT_UPLOADED")).toBe("NOT_UPLOADED");
    expect(videoSlotStatusSchema.parse("READY")).toBe("READY");
    expect(videoSlotStatusSchema.safeParse("DELETED").success).toBe(false);
  });

  test("a list carries slots and the lock state", () => {
    const parsed = videoSlotListResponseSchema.parse({
      items: [
        {
          id: "0198f1a0-0000-7000-8000-0000000000c1",
          order: 1,
          title: "Welcome",
          required: true,
          status: "NOT_UPLOADED",
          assetKey: null,
          rejectionReason: null,
          failureReason: null,
          uploadedAt: null,
          statusChangedAt: null,
        },
      ],
      locked: false,
    });
    expect(parsed.items[0]?.assetKey).toBeNull();
  });

  test("a slot carries the timestamps of its video", () => {
    const parsed = videoSlotListResponseSchema.parse({
      items: [
        {
          id: "0198f1a0-0000-7000-8000-0000000000c1",
          order: 1,
          title: "Welcome",
          required: true,
          status: "PROCESSING",
          assetKey: "a".repeat(32),
          rejectionReason: null,
          failureReason: null,
          uploadedAt: "2026-11-11T06:00:00.000Z",
          statusChangedAt: "2026-11-11T06:01:00.000Z",
        },
      ],
      locked: false,
    });
    expect(parsed.items[0]?.statusChangedAt).toBe("2026-11-11T06:01:00.000Z");
  });
});

describe("video failure reasons", () => {
  test("accepts the stored reasons and nothing else", () => {
    expect(videoFailureReasonSchema.parse("TIMED_OUT")).toBe("TIMED_OUT");
    expect(videoFailureReasonSchema.safeParse("OUT_OF_DISK").success).toBe(false);
  });
});

describe("video upload contracts", () => {
  const ids = {
    id: "0198f1a0-0000-7000-8000-0000000000c1",
    moduleId: "0198f1a0-0000-7000-8000-0000000000c2",
    videoId: "0198f1a0-0000-7000-8000-0000000000c3",
  };

  test("the upload route accepts only a 32 character url safe asset key", () => {
    expect(videoUploadParamsSchema.safeParse({ ...ids, assetKey: "a".repeat(32) }).success).toBe(
      true,
    );
    expect(videoUploadParamsSchema.safeParse({ ...ids, assetKey: "../etc/passwd" }).success).toBe(
      false,
    );
    expect(videoUploadParamsSchema.safeParse({ ...ids, assetKey: "a".repeat(31) }).success).toBe(
      false,
    );
  });

  test("the uploaded event carries the asset id only", () => {
    expect(videoUploadedPayloadSchema.safeParse({ assetId: ids.id }).success).toBe(true);
    expect(videoUploadedPayloadSchema.safeParse({ assetId: "x" }).success).toBe(false);
  });

  test("the size cap is two gibibytes", () => {
    expect(videoUploadLimits.maxBytes).toBe(2147483648);
  });
});

describe("video probe contracts", () => {
  test("lists the allowed containers and codecs and the rejection reasons", () => {
    expect(videoUploadLimits.containers).toContain("mp4");
    expect(videoUploadLimits.videoCodecs).toContain("h264");
    expect(videoRejectionReasonSchema.options).toContain("UNSUPPORTED_CODEC");
    expect(videoQueuedEventType).toBe("video.queued");
  });
});

describe("video processing polling", () => {
  test.each(["READY", "FAILED", "REJECTED", "NOT_UPLOADED"] as const)(
    "%s is final, so polling stops",
    (status) => {
      expect(videoStatusIsFinal(status)).toBe(true);
    },
  );

  test.each(["UPLOADING", "UPLOADED", "QUEUED", "PROCESSING"] as const)(
    "%s is not final, so polling continues",
    (status) => {
      expect(videoStatusIsFinal(status)).toBe(false);
    },
  );

  test("the interval is a few seconds", () => {
    expect(videoPollIntervalMs).toBe(5000);
  });
});

describe("video library list", () => {
  test("applies defaults", () => {
    expect(videoLibraryListQuerySchema.parse({})).toEqual({
      sort: "-statusChangedAt",
      page: 1,
      pageSize: 25,
    });
  });

  test("filters by status and course", () => {
    const parsed = videoLibraryListQuerySchema.parse({
      status: "FAILED",
      courseId: "0198f1a0-0000-7000-8000-0000000000c1",
      page: "2",
      pageSize: "10",
    });
    expect(parsed).toMatchObject({ status: "FAILED", page: 2, pageSize: 10 });
  });

  test("refuses a slot that was never uploaded as a status filter", () => {
    expect(videoLibraryListQuerySchema.safeParse({ status: "NOT_UPLOADED" }).success).toBe(false);
  });

  test("refuses an unlisted page size", () => {
    expect(videoLibraryListQuerySchema.safeParse({ pageSize: "7" }).success).toBe(false);
  });

  test("a row names its course, module and failure", () => {
    const parsed = videoLibraryListResponseSchema.parse({
      items: [
        {
          id: "0198f1a0-0000-7000-8000-0000000000c1",
          title: "Welcome",
          status: "FAILED",
          rejectionReason: null,
          failureReason: "TIMED_OUT",
          uploadedAt: "2026-11-11T06:00:00.000Z",
          statusChangedAt: "2026-11-11T06:01:00.000Z",
          course: { id: "0198f1a0-0000-7000-8000-0000000000c2", title: "HEAT" },
          module: { id: "0198f1a0-0000-7000-8000-0000000000c3", title: "Module 1" },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    });
    expect(parsed.items[0]?.failureReason).toBe("TIMED_OUT");
  });
});
