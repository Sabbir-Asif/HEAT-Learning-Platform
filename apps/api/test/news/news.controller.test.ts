import { describe, expect, test } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { IS_PUBLIC } from "../../src/auth/public.decorator";
import { NewsController } from "../../src/news/news.controller";
import { PublicNewsController } from "../../src/news/public-news.controller";

describe("NewsController", () => {
  test("is for admins only with an explicit role list", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, NewsController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, NewsController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test("audits every write", () => {
    for (const name of ["create", "update", "remove"] as const) {
      expect(Reflect.getMetadata(AUDITED_KEY, NewsController.prototype[name])).toBeDefined();
    }
  });
});

describe("PublicNewsController", () => {
  test("is public with no audience", () => {
    expect(Reflect.getMetadata(IS_PUBLIC, PublicNewsController)).toBe(true);
    expect(Reflect.getMetadata(AUDIENCE_KEY, PublicNewsController)).toBeUndefined();
  });
});
