import { describe, expect, test } from "vitest";
import { orderBy, statusWhere } from "../../src/resources/resource-rules";

describe("resource list rules", () => {
  test("filters by published state", () => {
    expect(statusWhere("published")).toEqual({ published: true });
    expect(statusWhere("unpublished")).toEqual({ published: false });
    expect(statusWhere("all")).toEqual({});
  });

  test("orders by display order unless another sort is chosen", () => {
    expect(orderBy(undefined)).toEqual({ displayOrder: "asc" });
    expect(orderBy("-title")).toEqual({ title: "desc" });
    expect(orderBy("-updatedAt")).toEqual({ updatedAt: "desc" });
  });
});
