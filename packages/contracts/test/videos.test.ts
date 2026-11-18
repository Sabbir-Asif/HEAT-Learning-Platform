import { describe, expect, test } from "vitest";
import {
  createVideoSlotRequestSchema,
  updateVideoSlotRequestSchema,
  videoSlotListResponseSchema,
  videoSlotStatusSchema,
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
          captions: [],
        },
      ],
      locked: false,
    });
    expect(parsed.items[0]?.assetKey).toBeNull();
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
