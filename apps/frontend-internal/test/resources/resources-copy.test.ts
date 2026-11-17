import { describe, expect, test } from "vitest";
import {
  resourceSaveFailedMessage,
  resourceUploadFailedMessage,
} from "../../src/resources/resources-copy";
import { resourceStatusFromUrl } from "../../src/resources/resources-status";

describe("resource messages", () => {
  test("names the upload rejection reasons", () => {
    expect(resourceUploadFailedMessage("UPLOAD_TYPE_NOT_ALLOWED")).toContain("PDF");
    expect(resourceUploadFailedMessage("UPLOAD_TOO_LARGE")).toContain("25 MB");
    expect(resourceUploadFailedMessage(undefined)).toContain("Try again");
  });

  test("explains a rejected save", () => {
    expect(resourceSaveFailedMessage("VALIDATION_FAILED")).toContain("highlighted");
    expect(resourceSaveFailedMessage(undefined)).toContain("could not be saved");
  });

  test("reads the status filter from the address and defaults to all", () => {
    expect(resourceStatusFromUrl("published")).toBe("published");
    expect(resourceStatusFromUrl("nonsense")).toBe("all");
    expect(resourceStatusFromUrl(undefined)).toBe("all");
  });
});
