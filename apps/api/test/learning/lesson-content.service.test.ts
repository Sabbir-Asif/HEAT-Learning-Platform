import { NotFoundException } from "@nestjs/common";
import { describe, expect, test, vi } from "vitest";
import { LessonContentService } from "../../src/learning/lesson-content.service";

const ids = {
  course: "0198f1a0-0000-7000-8000-000000000001",
  revision: "0198f1a0-0000-7000-8000-000000000002",
  m1: "0198f1a0-0000-7000-8000-000000000011",
  m2: "0198f1a0-0000-7000-8000-000000000012",
  s1: "0198f1a0-0000-7000-8000-000000000031",
};

interface Options {
  enrollment?: object | null;
  progress?: object[];
  moduleIds?: string[];
}

const enrollmentRow = (overrides: object = {}) => ({
  id: "e1",
  status: "APPROVED",
  courseRevisionId: ids.revision,
  course: { deletedAt: null },
  courseRevision: { id: ids.revision, number: 3, deletedAt: null },
  ...overrides,
});

const sectionRow = {
  id: ids.s1,
  order: 1,
  title: "Intro",
  schemaVersion: 1,
  body: { type: "doc", content: [] },
};

const build = (options: Options = {}) => {
  const database = {
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.enrollment === undefined ? enrollmentRow() : options.enrollment),
    },
    module: {
      findMany: vi
        .fn()
        .mockResolvedValue((options.moduleIds ?? [ids.m1, ids.m2]).map((id) => ({ id }))),
      findFirst: vi.fn().mockResolvedValue({
        id: ids.m1,
        title: "Module 1",
        objectives: ["Know the policy"],
        lessonSections: [sectionRow],
      }),
    },
    moduleProgress: {
      findMany: vi
        .fn()
        .mockResolvedValue(options.progress ?? [{ moduleId: ids.m1, status: "UNLOCKED" }]),
    },
  };
  return { service: new LessonContentService(database as never), database };
};

describe("LessonContentService.read", () => {
  test("returns the section bodies and objectives of an unlocked module", async () => {
    const { service } = build();

    expect(await service.read("u1", ids.course, ids.m1)).toEqual({
      module: { id: ids.m1, title: "Module 1", objectives: ["Know the policy"] },
      sections: [sectionRow],
    });
  });

  test("reads from the pinned revision and scopes the enrollment to the caller", async () => {
    const { service, database } = build();

    await service.read("u1", ids.course, ids.m1);

    expect(database.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1", courseId: ids.course, deletedAt: null },
      }),
    );
    expect(database.module.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revisionId: ids.revision, deletedAt: null } }),
    );
    expect(database.module.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ids.m1, revisionId: ids.revision, deletedAt: null },
      }),
    );
  });

  test("a locked module is refused with 403 MODULE_LOCKED and no content is read", async () => {
    const { service, database } = build();

    await expect(service.read("u1", ids.course, ids.m2)).rejects.toMatchObject({
      status: 403,
      code: "MODULE_LOCKED",
    });
    expect(database.module.findFirst).not.toHaveBeenCalled();
  });

  test("a module whose previous module is completed opens", async () => {
    const { service } = build({
      progress: [
        { moduleId: ids.m1, status: "COMPLETED" },
        { moduleId: ids.m2, status: "UNLOCKED" },
      ],
    });

    await expect(service.read("u1", ids.course, ids.m2)).resolves.toBeDefined();
  });

  test("a completed enrollment reads every module", async () => {
    const { service } = build({
      enrollment: enrollmentRow({ status: "COMPLETED" }),
      progress: [],
    });

    await expect(service.read("u1", ids.course, ids.m2)).resolves.toBeDefined();
  });

  test.each(["PENDING_APPROVAL", "REMOVED", "REJECTED", "EXPIRED"])(
    "a %s enrollment is refused with 403 ENROLLMENT_NOT_ACTIVE before any module is read",
    async (status) => {
      const { service, database } = build({
        enrollment: enrollmentRow({ status, courseRevisionId: null, courseRevision: null }),
      });

      await expect(service.read("u1", ids.course, ids.m1)).rejects.toMatchObject({
        status: 403,
        code: "ENROLLMENT_NOT_ACTIVE",
      });
      expect(database.module.findMany).not.toHaveBeenCalled();
    },
  );

  test("no enrollment is refused with 403 ENROLLMENT_NOT_ACTIVE", async () => {
    const { service } = build({ enrollment: null });

    await expect(service.read("u1", ids.course, ids.m1)).rejects.toMatchObject({
      code: "ENROLLMENT_NOT_ACTIVE",
    });
  });

  test("a stored body that is not an object is returned as an empty one", async () => {
    const { service, database } = build();
    database.module.findFirst.mockResolvedValue({
      id: ids.m1,
      title: "Module 1",
      objectives: [],
      lessonSections: [{ ...sectionRow, body: ["x"] }],
    });

    const result = await service.read("u1", ids.course, ids.m1);

    expect(result.sections[0]?.body).toEqual({});
  });

  test("a module outside the pinned revision is not found", async () => {
    const { service } = build({ moduleIds: [ids.m2] });

    await expect(service.read("u1", ids.course, ids.m1)).rejects.toThrow(NotFoundException);
  });
});
