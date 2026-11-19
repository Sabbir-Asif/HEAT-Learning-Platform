import { videoFailureReasonSchema, videoPollIntervalMs } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  moduleDeleteFailedMessage,
  moduleFormValuesOf,
  moduleRequestOf,
  reorderFailedMessage,
  videoSlotDeleteFailedMessage,
  videoSlotLockedMessage,
  videoFailureMessage,
  videoProcessingLabel,
  videoRejectionMessage,
  videoRetryFailedMessage,
  videoTimeLabel,
  videoSlotsPollInterval,
  videoUploadFailedMessage,
} from "../../src/modules/modules-copy";

describe("moduleFormValuesOf", () => {
  test("turns objectives into rows and an empty module into no rows", () => {
    expect(moduleFormValuesOf({ title: "Consent", objectives: ["Know", "Act"] })).toEqual({
      title: "Consent",
      objectives: [{ text: "Know" }, { text: "Act" }],
    });
    expect(moduleFormValuesOf(null)).toEqual({ title: "", objectives: [] });
  });
});

describe("moduleRequestOf", () => {
  test("flattens the rows back into an ordered list of texts", () => {
    expect(moduleRequestOf({ title: "A", objectives: [{ text: "One" }, { text: "Two" }] })).toEqual(
      { title: "A", objectives: ["One", "Two"] },
    );
  });
});

describe("reorderFailedMessage", () => {
  test("tells the admin to reload after a conflict and names a locked course", () => {
    expect(reorderFailedMessage("ORDER_CONFLICT")).toContain("Reload");
    expect(reorderFailedMessage("CONTENT_LOCKED")).toContain("locked");
  });

  test("falls back to a retry message for anything else", () => {
    expect(reorderFailedMessage(undefined)).toBe("The order could not be saved. Try again.");
  });
});

describe("moduleDeleteFailedMessage", () => {
  test("names the module", () => {
    expect(moduleDeleteFailedMessage("Consent")).toBe("Consent could not be deleted. Try again.");
  });
});

describe("video slot copy", () => {
  test("names the slot that could not be removed", () => {
    expect(videoSlotDeleteFailedMessage("Welcome")).toBe(
      "Welcome could not be removed. Try again.",
    );
  });

  test("explains what a locked course refuses", () => {
    expect(videoSlotLockedMessage).toContain("locked");
    expect(videoSlotLockedMessage).toContain("required");
  });
});

describe("videoUploadFailedMessage", () => {
  test("says why the server refused the upload", () => {
    expect(videoUploadFailedMessage("CONTENT_LOCKED")).toContain("locked");
    expect(videoUploadFailedMessage("UPLOAD_TOO_LARGE")).toContain("limit");
    expect(videoUploadFailedMessage("UPLOAD_TYPE_NOT_ALLOWED")).toContain("MP4, MOV, WebM or MKV");
    expect(videoUploadFailedMessage("UPLOAD_EXPIRED")).toContain("expired");
    expect(videoUploadFailedMessage("RATE_LIMITED")).toContain("Wait");
  });

  test("says the connection dropped and that retry continues", () => {
    expect(videoUploadFailedMessage("NETWORK_ERROR")).toContain("Retry");
  });

  test("falls back to a plain message for anything else", () => {
    expect(videoUploadFailedMessage(undefined)).toBe("The upload failed. Try again.");
    expect(videoUploadFailedMessage("INTERNAL")).toBe("The upload failed. Try again.");
  });
});

describe("videoRejectionMessage", () => {
  test("explains each reason the probe can give", () => {
    expect(videoRejectionMessage("NOT_A_VIDEO")).toContain("not a video");
    expect(videoRejectionMessage("UNSUPPORTED_CONTAINER")).toContain("format");
    expect(videoRejectionMessage("UNSUPPORTED_CODEC")).toContain("video codec is not supported");
    expect(videoRejectionMessage("TOO_LARGE")).toContain("limit");
    expect(videoRejectionMessage("NO_DURATION")).toContain("incomplete");
  });
});

describe("videoProcessingLabel", () => {
  test("says what the video is waiting for or doing", () => {
    expect(videoProcessingLabel("QUEUED", null)).toBe("Waiting to be processed");
    expect(videoProcessingLabel("PROCESSING", null)).toBe("Starting to process");
    expect(videoProcessingLabel("PROCESSING", 50)).toBe("Processing the video");
  });
});

describe("videoFailureMessage", () => {
  test("says why processing failed for every stored reason", () => {
    for (const reason of videoFailureReasonSchema.options) {
      expect(videoFailureMessage(reason)).toMatch(/^Processing failed/);
    }
    expect(videoFailureMessage("TIMED_OUT")).toContain("too long");
  });

  test("still reads sensibly when no reason was stored", () => {
    expect(videoFailureMessage(null)).toBe("Processing failed.");
  });
});

describe("videoRetryFailedMessage", () => {
  test("explains a video that is no longer failed", () => {
    expect(videoRetryFailedMessage("VIDEO_NOT_FAILED")).toContain("no longer failed");
  });

  test("falls back for any other error", () => {
    expect(videoRetryFailedMessage(undefined)).toBe("The video could not be retried. Try again.");
  });
});

describe("videoSlotsPollInterval", () => {
  test("polls while any video is still being processed", () => {
    expect(videoSlotsPollInterval([{ status: "READY" }, { status: "PROCESSING" }])).toBe(
      videoPollIntervalMs,
    );
    expect(videoSlotsPollInterval([{ status: "QUEUED" }])).toBe(videoPollIntervalMs);
  });

  test("stops once every video is ready, failed, rejected or empty", () => {
    expect(
      videoSlotsPollInterval([
        { status: "READY" },
        { status: "FAILED" },
        { status: "REJECTED" },
        { status: "NOT_UPLOADED" },
      ]),
    ).toBe(false);
  });

  test("does not poll before the list has loaded or when it is empty", () => {
    expect(videoSlotsPollInterval(undefined)).toBe(false);
    expect(videoSlotsPollInterval([])).toBe(false);
  });
});

describe("videoTimeLabel", () => {
  test("shows the time in Asia/Dhaka", () => {
    expect(videoTimeLabel("2026-11-11T06:00:00.000Z")).toBe("11 Nov 2026, 12:00 pm");
  });

  test("shows a dash when there is no time", () => {
    expect(videoTimeLabel(null)).toBe("-");
  });
});
