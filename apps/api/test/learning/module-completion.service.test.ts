import { describe, expect, test, vi } from "vitest";
import { ModuleCompletionService } from "../../src/learning/module-completion.service";

interface Options {
  status?: string;
  revisionId?: string | null;
  enrollmentMissing?: boolean;
  progress?: { moduleId: string; status: string }[];
  progressUpdates?: number[];
  enrollmentUpdate?: number;
  passed?: boolean;
  moduleId?: string;
}

const build = (options: Options = {}) => {
  const updates = [...(options.progressUpdates ?? [1, 1])];
  const tx = {
    enrollment: {
      findFirst: vi.fn().mockResolvedValue(
        options.enrollmentMissing === true
          ? null
          : {
              status: options.status ?? "APPROVED",
              courseRevisionId: options.revisionId === undefined ? "r1" : options.revisionId,
            },
      ),
      updateMany: vi.fn().mockResolvedValue({ count: options.enrollmentUpdate ?? 1 }),
    },
    module: { findMany: vi.fn().mockResolvedValue([{ id: "m1" }, { id: "m2" }, { id: "m3" }]) },
    moduleProgress: {
      findMany: vi.fn().mockResolvedValue(options.progress ?? []),
      updateMany: vi.fn(async () => ({ count: updates.shift() ?? 0 })),
      create: vi.fn().mockResolvedValue({}),
    },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const event = {
    tx,
    userId: "u1",
    courseId: "c1",
    moduleId: options.moduleId ?? "m2",
    enrollmentId: "e1",
    quizId: "z1",
    result: { passed: options.passed ?? true },
  };
  return { tx, run: () => new ModuleCompletionService().onQuizScored(event as never) };
};

describe("ModuleCompletionService", () => {
  test("a failed attempt changes nothing and reads nothing", async () => {
    const { tx, run } = build({ passed: false });
    await run();
    expect(tx.enrollment.findFirst).not.toHaveBeenCalled();
    expect(tx.moduleProgress.updateMany).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("completes the module and unlocks the next one with guarded updates", async () => {
    const { tx, run } = build({
      progress: [
        { moduleId: "m1", status: "COMPLETED" },
        { moduleId: "m2", status: "QUIZ_READY" },
        { moduleId: "m3", status: "LOCKED" },
      ],
    });
    await run();
    expect(tx.moduleProgress.updateMany).toHaveBeenNthCalledWith(1, {
      where: { enrollmentId: "e1", moduleId: "m2", status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(tx.moduleProgress.updateMany).toHaveBeenNthCalledWith(2, {
      where: { enrollmentId: "e1", moduleId: "m3", status: "LOCKED" },
      data: { status: "UNLOCKED", unlockedAt: expect.any(Date) },
    });
    expect(tx.moduleProgress.create).not.toHaveBeenCalled();
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("creates missing progress rows for the module and the next one", async () => {
    const { tx, run } = build({ moduleId: "m1", progressUpdates: [0, 0] });
    await run();
    expect(tx.moduleProgress.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e1",
        moduleId: "m1",
        status: "COMPLETED",
        completedAt: expect.any(Date),
      },
    });
    expect(tx.moduleProgress.create).toHaveBeenCalledWith({
      data: {
        enrollmentId: "e1",
        moduleId: "m2",
        status: "UNLOCKED",
        unlockedAt: expect.any(Date),
      },
    });
  });

  test("on the last module completes the enrollment and writes one certificate request", async () => {
    const { tx, run } = build({
      moduleId: "m3",
      progress: [
        { moduleId: "m1", status: "COMPLETED" },
        { moduleId: "m2", status: "COMPLETED" },
        { moduleId: "m3", status: "QUIZ_READY" },
      ],
      progressUpdates: [1],
    });
    await run();
    expect(tx.enrollment.updateMany).toHaveBeenCalledWith({
      where: { id: "e1", status: "APPROVED" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(tx.outbox.create).toHaveBeenCalledTimes(1);
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: {
        eventType: "certificate.requested",
        payload: { enrollmentId: "e1", userId: "u1", courseId: "c1" },
      },
    });
  });

  test("writes no second outbox row when the enrollment is already completed", async () => {
    const { tx, run } = build({
      moduleId: "m3",
      status: "COMPLETED",
      progress: [
        { moduleId: "m1", status: "COMPLETED" },
        { moduleId: "m2", status: "COMPLETED" },
        { moduleId: "m3", status: "COMPLETED" },
      ],
    });
    await run();
    expect(tx.enrollment.updateMany).not.toHaveBeenCalled();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("writes no outbox row when a racing update already completed the enrollment", async () => {
    const { tx, run } = build({
      moduleId: "m3",
      enrollmentUpdate: 0,
      progress: [
        { moduleId: "m1", status: "COMPLETED" },
        { moduleId: "m2", status: "COMPLETED" },
        { moduleId: "m3", status: "QUIZ_READY" },
      ],
      progressUpdates: [1],
    });
    await run();
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("does not touch a next module that is already unlocked", async () => {
    const { tx, run } = build({
      progress: [
        { moduleId: "m2", status: "QUIZ_READY" },
        { moduleId: "m3", status: "UNLOCKED" },
      ],
    });
    await run();
    expect(tx.moduleProgress.updateMany).toHaveBeenCalledTimes(1);
  });

  test("refuses an enrollment without a pinned revision so the submission rolls back", async () => {
    const { run } = build({ revisionId: null });
    await expect(run()).rejects.toMatchObject({ code: "ENROLLMENT_NOT_ACTIVE" });
  });

  test("refuses a missing enrollment", async () => {
    const { run } = build({ enrollmentMissing: true });
    await expect(run()).rejects.toMatchObject({ code: "ENROLLMENT_NOT_ACTIVE" });
  });

  test("propagates a database error so the caller rolls back", async () => {
    const { tx, run } = build({ progress: [{ moduleId: "m2", status: "QUIZ_READY" }] });
    tx.moduleProgress.updateMany.mockRejectedValue(new Error("db down"));
    await expect(run()).rejects.toThrow("db down");
  });
});
