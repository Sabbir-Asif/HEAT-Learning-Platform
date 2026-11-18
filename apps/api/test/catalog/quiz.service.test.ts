import { describe, expect, test, vi } from "vitest";
import { AuditService } from "../../src/audit";
import { auditScopeStorage } from "../../src/audit/audit-scope";
import type { AuditChange } from "../../src/audit";
import { QuizService } from "../../src/catalog/quiz.service";

const courseId = "0198f1a0-0000-7000-8000-0000000000c1";
const at = new Date("2026-11-11T06:00:00.000Z");

interface OptionFixture {
  id: string;
  order: number;
  text: string;
  isCorrect: boolean;
}

interface QuestionFixture {
  id: string;
  order: number;
  type: "SINGLE_CHOICE";
  text: string;
  explanation: string | null;
  options: OptionFixture[];
}

const question = (
  id: string,
  order: number,
  overrides: Partial<QuestionFixture> = {},
): QuestionFixture => ({
  id,
  order,
  type: "SINGLE_CHOICE",
  text: `Question ${id}`,
  explanation: null,
  options: [
    { id: `${id}-1`, order: 1, text: "A", isCorrect: true },
    { id: `${id}-2`, order: 2, text: "B", isCorrect: false },
  ],
  ...overrides,
});

const quizRow = (questions: QuestionFixture[]) => ({
  id: "quiz",
  passMarkPercent: 70,
  attemptLimit: null,
  waitMinutes: 10,
  questions,
});

const build = (
  options: {
    lockedAt?: Date | null;
    questions?: QuestionFixture[];
    quiz?: boolean;
    siteValue?: { value: unknown };
  } = {},
) => {
  const questions = options.questions ?? [question("a", 1), question("b", 2), question("c", 3)];
  const calls: string[] = [];
  const hasQuiz = options.quiz ?? true;
  const database = {
    siteSetting: { findUnique: vi.fn().mockResolvedValue(options.siteValue ?? null) },
    $queryRaw: vi.fn().mockResolvedValue([{ lockedAt: options.lockedAt ?? null }]),
    course: {
      findUnique: vi.fn().mockResolvedValue({
        lockedAt: options.lockedAt ?? null,
        revisions: [{ id: "rev" }],
      }),
    },
    module: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(where.id === "m" ? { id: "m" } : null),
        ),
    },
    quiz: {
      findFirst: vi.fn().mockResolvedValue(hasQuiz ? quizRow(questions) : null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          ...quizRow([]),
          ...data,
        }),
      ),
      update: vi
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...quizRow(questions), ...data }),
        ),
    },
    question: {
      findFirst: vi
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) =>
          Promise.resolve(questions.find((item) => item.id === where.id) ?? null),
        ),
      findMany: vi.fn().mockResolvedValue(questions.map(({ id }) => ({ id }))),
      aggregate: vi.fn().mockResolvedValue({ _max: { order: 3 } }),
      create: vi.fn().mockResolvedValue(question("n", 4)),
      update: vi
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Partial<QuestionFixture> }) => {
            calls.push(`${where.id}:${String(data.order)}`);
            const base = questions.find((item) => item.id === where.id) ?? question(where.id, 1);
            return Promise.resolve({ ...base, ...data });
          },
        ),
      delete: vi.fn().mockResolvedValue({}),
    },
    option: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const service = new QuizService(database as never, new AuditService({} as never));
  const changes: AuditChange[] = [];
  const scope = { tx: database as never, changes, afterCommit: [], skipped: false };
  const inAuditScope = <T>(run: () => Promise<T>): Promise<T> => auditScopeStorage.run(scope, run);
  return { service, database, changes, calls, inAuditScope };
};

const failureOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

const request = (text = "Which?", explanation: string | null = null) => ({
  type: "SINGLE_CHOICE" as const,
  text,
  explanation,
  options: [
    { text: "A", isCorrect: true },
    { text: "B", isCorrect: false },
  ],
});

describe("QuizService.get", () => {
  test("returns the defaults for a module without a quiz and creates nothing", async () => {
    const { service, database } = build({ quiz: false });
    const result = await service.get(courseId, "m");
    expect(result).toEqual({
      id: null,
      rules: { passMarkPercent: 70, attemptLimit: null, waitMinutes: 10 },
      questions: [],
      locked: false,
    });
    expect(database.quiz.create).not.toHaveBeenCalled();
  });

  test("starts a module without a quiz at the site attempt limit", async () => {
    const { service } = build({ quiz: false, siteValue: { value: { attemptLimit: 5 } } });
    const result = await service.get(courseId, "m");
    expect(result.rules).toEqual({ passMarkPercent: 70, attemptLimit: 5, waitMinutes: 10 });
  });

  test("ignores a malformed site setting and stays unlimited", async () => {
    const { service } = build({ quiz: false, siteValue: { value: { attemptLimit: "x" } } });
    expect((await service.get(courseId, "m")).rules.attemptLimit).toBeNull();
  });

  test("returns questions in order with their options and the locked flag", async () => {
    const { service, database } = build({ lockedAt: at });
    const result = await service.get(courseId, "m");
    expect(result.questions.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(result.questions[0]?.options).toHaveLength(2);
    expect(result.locked).toBe(true);
    expect(database.quiz.findFirst.mock.calls[0]?.[0].select.questions.orderBy).toEqual({
      order: "asc",
    });
  });

  test("answers 404 for a module outside the course", async () => {
    const { service } = build();
    expect(await failureOf(service.get(courseId, "x"))).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("QuizService.updateRules", () => {
  const rules = { passMarkPercent: 80, attemptLimit: 3, waitMinutes: 5 };

  test("creates the quiz with the given rules when none exists", async () => {
    const { service, database, changes, inAuditScope } = build({ quiz: false });
    await inAuditScope(() => service.updateRules(courseId, "m", rules));
    expect(database.quiz.create.mock.calls[0]?.[0].data).toEqual({ moduleId: "m", ...rules });
    expect(changes[0]?.after).toMatchObject(rules);
  });

  test("updates an existing quiz and audits before and after", async () => {
    const { service, changes, inAuditScope } = build();
    await inAuditScope(() => service.updateRules(courseId, "m", rules));
    expect(changes[0]).toMatchObject({
      entityId: "quiz",
      before: { passMarkPercent: 70, attemptLimit: null, waitMinutes: 10 },
      after: rules,
    });
  });

  test("is refused with CONTENT_LOCKED when a rule changes on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(inAuditScope(() => service.updateRules(courseId, "m", rules))),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.quiz.update).not.toHaveBeenCalled();
  });

  test("accepts unchanged rules on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    await expect(
      inAuditScope(() =>
        service.updateRules(courseId, "m", {
          passMarkPercent: 70,
          attemptLimit: null,
          waitMinutes: 10,
        }),
      ),
    ).resolves.toBeDefined();
  });

  test("is refused on a locked course when no quiz exists yet", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at, quiz: false });
    expect(
      await failureOf(inAuditScope(() => service.updateRules(courseId, "m", rules))),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.quiz.create).not.toHaveBeenCalled();
  });
});

describe("QuizService.createQuestion", () => {
  test("creates the quiz with defaults when the module has none", async () => {
    const { service, database, inAuditScope } = build({ quiz: false });
    database.question.aggregate.mockResolvedValue({ _max: { order: null } });
    await inAuditScope(() => service.createQuestion(courseId, "m", request()));
    expect(database.quiz.create.mock.calls[0]?.[0].data).toEqual({
      moduleId: "m",
      attemptLimit: null,
    });
    expect(database.question.create.mock.calls[0]?.[0].data.order).toBe(1);
  });

  test("creates the quiz at the site attempt limit when one is set", async () => {
    const { service, database, inAuditScope } = build({
      quiz: false,
      siteValue: { value: { attemptLimit: 10 } },
    });
    database.question.aggregate.mockResolvedValue({ _max: { order: null } });
    await inAuditScope(() => service.createQuestion(courseId, "m", request()));
    expect(database.quiz.create.mock.calls[0]?.[0].data).toEqual({
      moduleId: "m",
      attemptLimit: 10,
    });
  });

  test("adds the question with the next order and ordered options", async () => {
    const { service, database, changes, inAuditScope } = build();
    await inAuditScope(() => service.createQuestion(courseId, "m", request("Which?", "Because")));
    expect(database.quiz.create).not.toHaveBeenCalled();
    expect(database.question.create.mock.calls[0]?.[0].data).toEqual({
      quizId: "quiz",
      order: 4,
      type: "SINGLE_CHOICE",
      text: "Which?",
      explanation: "Because",
      options: {
        create: [
          { order: 1, text: "A", isCorrect: true },
          { order: 2, text: "B", isCorrect: false },
        ],
      },
    });
    expect(changes[0]?.entityId).toBe("n");
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(inAuditScope(() => service.createQuestion(courseId, "m", request()))),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.question.create).not.toHaveBeenCalled();
  });
});

describe("QuizService.updateQuestion", () => {
  const changedOptions = {
    ...request("Which?"),
    options: [
      { text: "A", isCorrect: false },
      { text: "B", isCorrect: true },
    ],
  };

  test("replaces the options when they changed on an unlocked course", async () => {
    const { service, database, inAuditScope } = build();
    await inAuditScope(() => service.updateQuestion(courseId, "m", "a", changedOptions));
    expect(database.option.deleteMany).toHaveBeenCalledWith({ where: { questionId: "a" } });
    expect(database.option.createMany.mock.calls[0]?.[0].data).toEqual([
      { order: 1, text: "A", isCorrect: false, questionId: "a" },
      { order: 2, text: "B", isCorrect: true, questionId: "a" },
    ]);
  });

  test("leaves the options alone when only the wording changed", async () => {
    const { service, database, inAuditScope } = build();
    await inAuditScope(() => service.updateQuestion(courseId, "m", "a", request("New wording")));
    expect(database.option.deleteMany).not.toHaveBeenCalled();
    expect(database.question.update.mock.calls[0]?.[0].data).toEqual({
      text: "New wording",
      explanation: null,
    });
  });

  test("saves a wording fix on a locked course and logs a before and after diff", async () => {
    const { service, changes, database, inAuditScope } = build({ lockedAt: at });
    await inAuditScope(() =>
      service.updateQuestion(courseId, "m", "a", request("Fixed wording", "Because")),
    );
    expect(database.option.deleteMany).not.toHaveBeenCalled();
    expect(changes[0]).toMatchObject({
      entityId: "a",
      before: { text: "Question a", explanation: null },
      after: { text: "Fixed wording", explanation: "Because" },
    });
  });

  test("refuses an option or correct answer change on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(
        inAuditScope(() => service.updateQuestion(courseId, "m", "a", changedOptions)),
      ),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.question.update).not.toHaveBeenCalled();
    expect(database.option.deleteMany).not.toHaveBeenCalled();
  });

  test("answers 404 for an unknown question", async () => {
    const { service, inAuditScope } = build();
    expect(
      await failureOf(inAuditScope(() => service.updateQuestion(courseId, "m", "zzz", request()))),
    ).toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("QuizService.removeQuestion", () => {
  test("deletes the options and the question and closes the gap", async () => {
    const { service, database, calls, inAuditScope } = build();
    database.question.findMany.mockResolvedValue([{ id: "b" }, { id: "c" }]);
    await inAuditScope(() => service.removeQuestion(courseId, "m", "a"));
    expect(database.option.deleteMany).toHaveBeenCalledWith({ where: { questionId: "a" } });
    expect(database.question.delete).toHaveBeenCalledWith({ where: { id: "a" } });
    expect(calls.filter((call) => !call.includes(":-"))).toEqual(["b:1", "c:2"]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, database, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(inAuditScope(() => service.removeQuestion(courseId, "m", "a"))),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
    expect(database.question.delete).not.toHaveBeenCalled();
  });
});

describe("QuizService.reorderQuestions", () => {
  test("renumbers through negative orders so no duplicate exists at any step", async () => {
    const { service, calls, inAuditScope } = build();
    await inAuditScope(() =>
      service.reorderQuestions(courseId, "m", {
        previousIds: ["a", "b", "c"],
        orderedIds: ["c", "a", "b"],
      }),
    );
    expect(calls).toEqual(["c:-1", "a:-2", "b:-3", "c:1", "a:2", "b:3"]);
  });

  test("answers ORDER_CONFLICT when another admin reordered first", async () => {
    const { service, calls, inAuditScope } = build();
    expect(
      await failureOf(
        inAuditScope(() =>
          service.reorderQuestions(courseId, "m", {
            previousIds: ["b", "a", "c"],
            orderedIds: ["c", "a", "b"],
          }),
        ),
      ),
    ).toMatchObject({ code: "ORDER_CONFLICT" });
    expect(calls).toEqual([]);
  });

  test("is refused with CONTENT_LOCKED on a locked course", async () => {
    const { service, inAuditScope } = build({ lockedAt: at });
    expect(
      await failureOf(
        inAuditScope(() =>
          service.reorderQuestions(courseId, "m", {
            previousIds: ["a", "b", "c"],
            orderedIds: ["c", "a", "b"],
          }),
        ),
      ),
    ).toMatchObject({ code: "CONTENT_LOCKED" });
  });
});
