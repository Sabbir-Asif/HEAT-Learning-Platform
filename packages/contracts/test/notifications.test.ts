import { describe, expect, test } from "vitest";
import {
  notificationDataSchema,
  notificationListQuerySchema,
  notificationSchema,
  notificationTypes,
} from "../src/index";

const id = "0192f2a0-7c1e-7b3a-8d4e-5f6a7b8c9d0e";

describe("notificationListQuerySchema", () => {
  test("defaults to the first page of twenty", () => {
    expect(notificationListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  test("coerces query strings", () => {
    expect(notificationListQuerySchema.parse({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  test("rejects a page below one and a page size above fifty", () => {
    expect(notificationListQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(notificationListQuerySchema.safeParse({ pageSize: "51" }).success).toBe(false);
  });
});

describe("notificationSchema", () => {
  test("accepts every notification type", () => {
    for (const type of notificationTypes) {
      const parsed = notificationSchema.safeParse({
        id,
        type,
        data: { courseId: id },
        readAt: null,
        createdAt: "2026-11-12T05:00:00.000Z",
      });
      expect(parsed.success).toBe(true);
    }
  });

  test("rejects an unknown type", () => {
    const parsed = notificationSchema.safeParse({
      id,
      type: "OTHER",
      data: {},
      readAt: null,
      createdAt: "2026-11-12T05:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("notificationDataSchema", () => {
  test("holds short strings only", () => {
    expect(notificationDataSchema.safeParse({ courseId: id, label: "HEAT" }).success).toBe(true);
    expect(notificationDataSchema.safeParse({ nested: { a: "b" } }).success).toBe(false);
    expect(notificationDataSchema.safeParse({ label: "x".repeat(201) }).success).toBe(false);
  });
});
