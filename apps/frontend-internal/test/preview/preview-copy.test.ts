import { describe, expect, test } from "vitest";
import { videoStatusMessage } from "../../src/preview/preview-copy";

describe("videoStatusMessage", () => {
  test.each(["UPLOADING", "UPLOADED", "QUEUED", "PROCESSING"] as const)(
    "says %s is still processing",
    (status) => {
      expect(videoStatusMessage(status)).toContain("still processing");
    },
  );

  test("distinguishes missing, failed and rejected videos", () => {
    expect(videoStatusMessage("NOT_UPLOADED")).toContain("No video");
    expect(videoStatusMessage("FAILED")).toContain("failed");
    expect(videoStatusMessage("REJECTED")).toContain("rejected");
  });
});
