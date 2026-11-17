import { describe, expect, test } from "vitest";
import {
  formatFileSize,
  isHttpsUrl,
  isKnownCacheTag,
  resourceFormSchema,
  resourceRequestFromForm,
  resourceRequestSchema,
  resourceTypeLabel,
  resourcesCacheTag,
} from "../src";

const assetId = "0198f6a0-0000-7000-8000-000000000001";

const link = { kind: "link", title: "Guide", url: "https://example.org/guide" };

const formValues = {
  kind: "link" as const,
  title: "Guide",
  description: "",
  url: "https://example.org/guide",
  mediaAssetId: "",
  courseId: "",
  displayOrder: "0",
  published: false,
};

describe("isHttpsUrl", () => {
  test.each([
    ["https://example.org", true],
    ["http://example.org", false],
    ["javascript:alert(1)", false],
    ["ftp://example.org", false],
    ["//example.org", false],
    ["example.org", false],
    ["https://", false],
  ])("%s", (value, expected) => {
    expect(isHttpsUrl(value)).toBe(expected);
  });
});

describe("resourceRequestSchema", () => {
  test("accepts a link with an https address and defaults the rest", () => {
    const parsed = resourceRequestSchema.parse(link);
    expect(parsed).toMatchObject({
      description: null,
      mediaAssetId: null,
      courseId: null,
      displayOrder: 0,
      published: false,
    });
  });

  test("rejects a link whose address is not https", () => {
    expect(resourceRequestSchema.safeParse({ ...link, url: "http://example.org" }).success).toBe(
      false,
    );
  });

  test("rejects a link without an address or with a file", () => {
    expect(resourceRequestSchema.safeParse({ kind: "link", title: "Guide" }).success).toBe(false);
    expect(resourceRequestSchema.safeParse({ ...link, mediaAssetId: assetId }).success).toBe(false);
  });

  test("accepts a file with an asset and rejects a file without one or with an address", () => {
    expect(
      resourceRequestSchema.safeParse({ kind: "file", title: "Slides", mediaAssetId: assetId })
        .success,
    ).toBe(true);
    expect(resourceRequestSchema.safeParse({ kind: "file", title: "Slides" }).success).toBe(false);
    expect(
      resourceRequestSchema.safeParse({
        kind: "file",
        title: "Slides",
        mediaAssetId: assetId,
        url: "https://example.org",
      }).success,
    ).toBe(false);
  });

  test("rejects a blank title and a negative order", () => {
    expect(resourceRequestSchema.safeParse({ ...link, title: "  " }).success).toBe(false);
    expect(resourceRequestSchema.safeParse({ ...link, displayOrder: -1 }).success).toBe(false);
  });
});

describe("resourceFormSchema", () => {
  test("uses the same https rule as the API", () => {
    expect(resourceFormSchema.safeParse(formValues).success).toBe(true);
    expect(resourceFormSchema.safeParse({ ...formValues, url: "http://example.org" }).success).toBe(
      false,
    );
  });

  test("requires an uploaded file for a file resource", () => {
    expect(resourceFormSchema.safeParse({ ...formValues, kind: "file" }).success).toBe(false);
    expect(
      resourceFormSchema.safeParse({ ...formValues, kind: "file", mediaAssetId: assetId }).success,
    ).toBe(true);
  });

  test("converts to a request the API accepts", () => {
    const request = resourceRequestFromForm({
      ...formValues,
      kind: "file",
      mediaAssetId: assetId,
      url: "",
      displayOrder: "3",
      description: "Notes",
    });
    expect(request).toMatchObject({ url: null, mediaAssetId: assetId, displayOrder: 3 });
    expect(resourceRequestSchema.safeParse(request).success).toBe(true);
  });
});

describe("labels and tags", () => {
  test("names the type and formats the size", () => {
    expect(resourceTypeLabel("link", null)).toBe("Link");
    expect(resourceTypeLabel("file", "application/pdf")).toBe("PDF");
    expect(resourceTypeLabel("file", "x/y")).toBe("File");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  test("the resources tag may be revalidated", () => {
    expect(isKnownCacheTag(resourcesCacheTag)).toBe(true);
  });
});

describe("resource edge rules", () => {
  test("rejects a web address longer than the limit", () => {
    expect(isHttpsUrl(`https://example.org/${"a".repeat(3000)}`)).toBe(false);
  });

  test("turns filled form values into a request", () => {
    expect(
      resourceRequestFromForm({
        ...formValues,
        kind: "file",
        description: "Notes",
        mediaAssetId: assetId,
        courseId: assetId,
        displayOrder: "4",
        published: true,
      }),
    ).toEqual({
      kind: "file",
      title: "Guide",
      description: "Notes",
      url: null,
      mediaAssetId: assetId,
      courseId: assetId,
      displayOrder: 4,
      published: true,
    });
  });

  test("requires an uploaded file for the file kind", () => {
    const result = resourceFormSchema.safeParse({ ...formValues, kind: "file" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["mediaAssetId"]);
  });

  test("labels a file with no known mime type", () => {
    expect(resourceTypeLabel("file", null)).toBe("File");
    expect(
      resourceTypeLabel(
        "file",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBe("PowerPoint");
  });
});
