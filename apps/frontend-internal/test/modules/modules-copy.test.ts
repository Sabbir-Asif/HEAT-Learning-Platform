import { describe, expect, test } from "vitest";
import {
  moduleDeleteFailedMessage,
  moduleFormValuesOf,
  moduleRequestOf,
  reorderFailedMessage,
  videoSlotDeleteFailedMessage,
  videoSlotLockedMessage,
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
