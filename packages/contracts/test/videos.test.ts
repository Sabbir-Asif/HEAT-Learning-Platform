import { describe, expect, test } from "vitest";
import {
  createVideoSlotRequestSchema,
  updateVideoSlotRequestSchema,
  videoSlotListResponseSchema,
  videoSlotStatusSchema,
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
        },
      ],
      locked: false,
    });
    expect(parsed.items[0]?.assetKey).toBeNull();
  });
});
