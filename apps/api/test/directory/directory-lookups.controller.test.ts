import { describe, expect, test } from "vitest";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import { DirectoryLookupsController } from "../../src/directory/directory-lookups.controller";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

describe("DirectoryLookupsController", () => {
  test("is public and rate limited as a whole", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, DirectoryLookupsController)).toBe(true);
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, DirectoryLookupsController)).toBe(
      "directoryLookup",
    );
  });

  test.each(["listUniversities", "listFaculties", "listDepartments"] as const)(
    "%s lets browsers keep the answer briefly",
    (handler) => {
      const headers = Reflect.getMetadata(
        "__headers__",
        DirectoryLookupsController.prototype[handler],
      ) as Array<{ name: string; value: string }>;

      expect(headers).toContainEqual({ name: "Cache-Control", value: "public, max-age=30" });
    },
  );
});
