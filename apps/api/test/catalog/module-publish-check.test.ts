import { describe, expect, test, vi } from "vitest";
import { ModulePublishCheck } from "../../src/catalog/module-publish-check";
import { ApiException } from "../../src/http/api-exception";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";

const moduleRow = (overrides: Record<string, unknown> = {}) => ({
  id: "m1",
  order: 1,
  title: "Consent",
  videos: [{ required: true, asset: { id: "a1", status: "READY" } }],
  quiz: {
    deletedAt: null,
    questions: [{ id: "q1", order: 1, options: [{ isCorrect: true }, { isCorrect: false }] }],
  },
  ...overrides,
});

const build = (modules: unknown[], revisions: unknown[] = [{ id: "rev" }]) => {
  const order: string[] = [];
  const client = {
    course: {
      findUnique: vi.fn().mockResolvedValue({ revisions }),
    },
    module: {
      findMany: vi.fn().mockImplementation(() => {
        order.push("read");
        return Promise.resolve(modules);
      }),
    },
    $queryRaw: vi.fn().mockImplementation(() => {
      order.push("lock");
      return Promise.resolve([]);
    }),
  };
  return { check: new ModulePublishCheck(client as never), client, order };
};

describe("ModulePublishCheck", () => {
  test("returns no failures for a complete revision", async () => {
    const { check, client } = build([moduleRow()]);

    expect(await check.failures(courseId, client as never)).toEqual([]);
  });

  test("names the module whose video is still processing", async () => {
    const videos = [{ required: true, asset: { id: "a1", status: "PROCESSING" } }];
    const { check, client } = build([moduleRow({ videos })]);

    expect(await check.failures(courseId, client as never)).toEqual([
      "Module 1 (Consent) has a required video that is not ready.",
    ]);
  });

  test("treats a slot without an asset as not ready", async () => {
    const { check, client } = build([moduleRow({ videos: [{ required: true, asset: null }] })]);

    expect(await check.failures(courseId, client as never)).toHaveLength(1);
  });

  test("refuses a revision with no modules", async () => {
    const { check, client } = build([]);

    expect(await check.failures(courseId, client as never)).toEqual(["The course has no modules."]);
  });

  test("reads only the latest revision's live content", async () => {
    const { check, client } = build([moduleRow()]);

    await check.failures(courseId, client as never);

    expect(client.module.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { revisionId: "rev", deletedAt: null } }),
    );
  });

  test("locks the video assets before reading their status when asked", async () => {
    const { check, client, order } = build([moduleRow()]);

    await check.failures(courseId, client as never);

    expect(order).toEqual(["read", "lock", "read"]);
  });

  test("evaluate skips the lock when not publishing", async () => {
    const { check, client, order } = build([moduleRow()]);

    await check.evaluate(courseId, client as never, false);

    expect(order).toEqual(["read"]);
  });

  test("reports a missing course as not found", async () => {
    const { check, client } = build([]);
    client.course.findUnique.mockResolvedValue(null);

    const error = await check.failures(courseId, client as never).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe("NOT_FOUND");
  });

  test("checklist reads through the database without locking", async () => {
    const { check, client, order } = build([moduleRow({ quiz: null })]);

    const checklist = await check.checklist(courseId);

    expect(checklist.failures.map((failure) => failure.code)).toEqual(["MODULE_NO_QUIZ"]);
    expect(order).toEqual(["read"]);
  });
});
