import { videoLibraryStatusSchema } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import {
  videoLibraryBadgeStatus,
  videoLibraryParams,
  videoLibrarySortValue,
  videoLibraryStatusFilterOptions,
  videoLibraryStatusLabels,
} from "../../src/video-library/video-library-copy";

describe("video library copy", () => {
  test("sorts by last change, newest first, unless the table says otherwise", () => {
    expect(videoLibrarySortValue(null)).toBe("-statusChangedAt");
    expect(videoLibrarySortValue({ id: "title", desc: false })).toBe("title");
    expect(videoLibrarySortValue({ id: "title", desc: true })).toBe("-title");
    expect(videoLibrarySortValue({ id: "statusChangedAt", desc: false })).toBe("statusChangedAt");
    expect(videoLibrarySortValue({ id: "statusChangedAt", desc: true })).toBe("-statusChangedAt");
  });

  test("maps every status to the shared badge key and a label", () => {
    expect(videoLibraryBadgeStatus("PROCESSING")).toBe("processing");
    for (const status of videoLibraryStatusSchema.options) {
      expect(videoLibraryStatusLabels[status]).toBeTruthy();
    }
  });

  test("offers every uploaded status as a URL filter value", () => {
    expect(videoLibraryStatusFilterOptions.status).toEqual(videoLibraryStatusSchema.options);
  });

  test("sends only the filters that are set", () => {
    expect(
      videoLibraryParams({ page: 2, pageSize: 25, sort: null, status: "", course: "" }),
    ).toEqual({ page: 2, pageSize: 25, sort: "-statusChangedAt" });
    expect(
      videoLibraryParams({
        page: 1,
        pageSize: 10,
        sort: { id: "title", desc: false },
        status: "FAILED",
        course: "course-id",
      }),
    ).toEqual({ page: 1, pageSize: 10, sort: "title", status: "FAILED", courseId: "course-id" });
  });

  test("ignores a status that is not a video status", () => {
    expect(
      videoLibraryParams({ page: 1, pageSize: 25, sort: null, status: "BOGUS", course: "" }),
    ).not.toHaveProperty("status");
  });
});
