import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { TagAssignmentsService } from "../../src/catalog/tag-assignments.service";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const tagRef = (id: string) => ({ id, slug: id, name: id, isSystem: false });

const build = (
  options: { lockedAt?: Date | null; existingTags?: string[]; highest?: number | null } = {},
) => {
  const database = {
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt: options.lockedAt ?? null,
        revisions: [{ id: "rev" }],
      }),
    },
    module: { findFirst: vi.fn().mockResolvedValue({ id: "m1" }) },
    tag: {
      count: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
          Promise.resolve(where.id.in.length),
        ),
    },
    courseTag: {
      findMany: vi
        .fn()
        .mockImplementation(({ select }: { select: Record<string, unknown> }) =>
          Promise.resolve(
            "tagId" in select
              ? (options.existingTags ?? []).map((tagId) => ({ tagId }))
              : "courseId" in select
                ? [{ courseId: "other" }]
                : [{ tag: tagRef("new") }],
          ),
        ),
      aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: options.highest ?? null } }),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    moduleTag: {
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _max: { displayOrder: null } }),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const revalidate = vi.fn().mockResolvedValue(undefined);
  const service = new TagAssignmentsService(database as never, new AuditService({} as never), {
    revalidate,
  } as never);
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

describe("TagAssignmentsService.setCourseTags", () => {
  test("appends a new link after the tag's highest display order", async () => {
    const { service, database, changes, inAuditScope } = build({ highest: 3 });
    await inAuditScope(() => service.setCourseTags(courseId, { tagIds: ["new"] }));
    expect(database.courseTag.create).toHaveBeenCalledWith({
      data: { courseId, tagId: "new", displayOrder: 4 },
    });
    expect(changes[0]).toMatchObject({ before: { tagIds: [] }, after: { tagIds: ["new"] } });
  });

  test("succeeds on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: new Date() });
    await inAuditScope(() => service.setCourseTags(courseId, { tagIds: ["new"] }));
    expect(database.courseTag.create).toHaveBeenCalled();
  });

  test("removes a dropped tag and keeps the remaining order dense", async () => {
    const { service, database, inAuditScope } = build({ existingTags: ["old"] });
    await inAuditScope(() => service.setCourseTags(courseId, { tagIds: [] }));
    expect(database.courseTag.deleteMany).toHaveBeenCalledWith({
      where: { courseId, tagId: "old" },
    });
    expect(database.courseTag.update).toHaveBeenCalledWith({
      where: { courseId_tagId: { courseId: "other", tagId: "old" } },
      data: { displayOrder: 1 },
    });
  });

  test("refuses an unknown tag with a field error", async () => {
    const { service, database, inAuditScope } = build();
    database.tag.count.mockResolvedValue(0);
    const error = await failureOf(
      inAuditScope(() => service.setCourseTags(courseId, { tagIds: ["ghost"] })),
    );
    expect(error).toMatchObject({ code: "VALIDATION_FAILED" });
    expect(database.courseTag.create).not.toHaveBeenCalled();
  });
});

describe("TagAssignmentsService.setModuleTags", () => {
  test("answers 404 for a module outside the course", async () => {
    const { service, database, inAuditScope } = build();
    database.module.findFirst.mockResolvedValue(null);
    const error = await failureOf(
      inAuditScope(() => service.setModuleTags(courseId, "m1", { tagIds: ["new"] })),
    );
    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  test("tags a module of the course", async () => {
    const { service, database, inAuditScope } = build();
    await inAuditScope(() => service.setModuleTags(courseId, "m1", { tagIds: ["new"] }));
    expect(database.moduleTag.create).toHaveBeenCalledWith({
      data: { moduleId: "m1", tagId: "new", displayOrder: 1 },
    });
  });
});
