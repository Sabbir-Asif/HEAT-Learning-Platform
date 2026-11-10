import { describe, expect, test, vi } from "vitest";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import { DirectoryLookupsController } from "../../src/directory/directory-lookups.controller";
import { strongEtagOf } from "../../src/directory/conditional-response";
import { RATE_LIMIT_PROFILE_KEY } from "../../src/rate-limit/rate-limit.guard";

const universityId = "0198f1a0-0000-7000-8000-000000000001";
const facultyId = "0198f1a0-0000-7000-8000-000000000002";
const body = { items: [{ id: universityId, name: "Dhaka" }] };

const build = () => {
  const lookups = {
    universities: vi.fn().mockResolvedValue(body),
    faculties: vi.fn().mockResolvedValue(body),
    departments: vi.fn().mockResolvedValue(body),
  };
  const response = { setHeader: vi.fn(), status: vi.fn() };
  return { controller: new DirectoryLookupsController(lookups as never), lookups, response };
};

const request = (ifNoneMatch?: string) => ({
  headers: ifNoneMatch === undefined ? {} : { "if-none-match": ifNoneMatch },
});

describe("DirectoryLookupsController metadata", () => {
  test("is public and rate limited as a whole", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, DirectoryLookupsController)).toBe(true);
    expect(Reflect.getMetadata(RATE_LIMIT_PROFILE_KEY, DirectoryLookupsController)).toBe(
      "directoryLookup",
    );
  });

  test.each(["listUniversities", "listFaculties", "listDepartments"] as const)(
    "%s makes browsers revalidate on every use",
    (handler) => {
      const headers = Reflect.getMetadata(
        "__headers__",
        DirectoryLookupsController.prototype[handler],
      ) as Array<{ name: string; value: string }>;

      expect(headers).toContainEqual({ name: "Cache-Control", value: "no-cache" });
    },
  );
});

describe("DirectoryLookupsController revalidation", () => {
  test("a first request gets the body with a strong ETag and no status change", async () => {
    const { controller, response } = build();

    const result = await controller.listUniversities(request(), response);

    expect(result).toEqual(body);
    expect(response.setHeader).toHaveBeenCalledWith("ETag", strongEtagOf(body));
    expect(strongEtagOf(body)).toMatch(/^"[A-Za-z0-9_-]+"$/);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("a matching If-None-Match is a 304 with no body", async () => {
    const { controller, response } = build();

    const result = await controller.listUniversities(request(strongEtagOf(body)), response);

    expect(result).toBeUndefined();
    expect(response.status).toHaveBeenCalledWith(304);
  });

  test("a stale If-None-Match gets the full body again", async () => {
    const { controller, response } = build();

    const result = await controller.listUniversities(request('"old"'), response);

    expect(result).toEqual(body);
    expect(response.status).not.toHaveBeenCalled();
  });

  test("a changed payload changes the ETag", () => {
    expect(strongEtagOf({ items: [] })).not.toBe(strongEtagOf(body));
  });

  test("faculty and department lookups revalidate too", async () => {
    const { controller, lookups, response } = build();

    const faculties = await controller.listFaculties(
      { universityId },
      request(strongEtagOf(body)),
      response,
    );
    const departments = await controller.listDepartments(
      { universityId, facultyId },
      request(`W/${strongEtagOf(body)}, "x"`),
      response,
    );

    expect(faculties).toBeUndefined();
    expect(departments).toBeUndefined();
    expect(lookups.faculties).toHaveBeenCalledWith(universityId);
    expect(lookups.departments).toHaveBeenCalledWith(universityId, facultyId);
  });
});
