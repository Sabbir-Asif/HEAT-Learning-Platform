import { describe, expect, test } from "vitest";
import {
  courseFormSchema,
  courseListQuerySchema,
  createCourseRequestSchema,
  errorResponseSchema,
} from "../src/index";

const valid = { title: "HEAT Foundations", slug: "heat-foundations" };

describe("createCourseRequestSchema", () => {
  test("normalises the title and defaults the optional fields to null", () => {
    const parsed = createCourseRequestSchema.parse({ ...valid, title: "  HEAT   Foundations " });
    expect(parsed).toEqual({
      title: "HEAT Foundations",
      slug: "heat-foundations",
      description: null,
      thumbnailAssetId: null,
    });
  });

  test("turns a blank description into null", () => {
    expect(
      createCourseRequestSchema.parse({ ...valid, description: "   " }).description,
    ).toBeNull();
  });

  test.each(["Heat", "heat_foundations", "-heat", "heat-", "heat--course", "heat course", ""])(
    "rejects the slug %j",
    (slug) => {
      expect(createCourseRequestSchema.safeParse({ ...valid, slug }).success).toBe(false);
    },
  );

  test("rejects a missing title, an invisible character and a bad asset id", () => {
    expect(createCourseRequestSchema.safeParse({ slug: "a" }).success).toBe(false);
    expect(createCourseRequestSchema.safeParse({ ...valid, title: "A‮B" }).success).toBe(false);
    expect(
      createCourseRequestSchema.safeParse({ ...valid, thumbnailAssetId: "nope" }).success,
    ).toBe(false);
  });
});

describe("courseFormSchema", () => {
  test("keeps the description as text for the form", () => {
    expect(courseFormSchema.parse({ ...valid, description: "" }).description).toBe("");
  });
});

describe("courseListQuerySchema", () => {
  test("defaults to all statuses, page 1 and 25 rows", () => {
    expect(courseListQuerySchema.parse({})).toEqual({ status: "all", page: 1, pageSize: 25 });
  });

  test("rejects an unknown status and an unsupported page size", () => {
    expect(courseListQuerySchema.safeParse({ status: "archived" }).success).toBe(false);
    expect(courseListQuerySchema.safeParse({ pageSize: "7" }).success).toBe(false);
  });
});

describe("errorResponseSchema failures", () => {
  test("accepts a list of failure messages", () => {
    const body = {
      error: {
        code: "COURSE_PUBLISH_CHECKS_FAILED",
        message: "m",
        requestId: "r",
        failures: ["Module 1 has no ready video."],
      },
    };
    expect(errorResponseSchema.parse(body).error.failures).toHaveLength(1);
  });
});
