import { Inject, Injectable } from "@nestjs/common";
import { quizDefaults, quizSettingsKey } from "@heat/contracts";
import type {
  QuestionType,
  QuizOptionRequest,
  QuizQuestionRequest,
  QuizQuestionSummary,
  QuizRulesRequest,
  QuizSummary,
  ReorderRequest,
  UpdateQuizQuestionRequest,
} from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { AuditService } from "../audit";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { applyOrderPlan, lockScope, readScope } from "./content-access";
import type { ContentLocker } from "./content-access";
import { assertContentUnlocked, nextOrder, planReorder, planResequence } from "./module-rules";
import { assertOptionsUnlocked, assertRulesUnlocked } from "./quiz-rules";
import { readStoredQuizSettings } from "./quiz-settings-rules";

type QuizClient = Pick<HeatClient, "module" | "quiz" | "question" | "option" | "siteSetting">;

const questionSelect = {
  id: true,
  order: true,
  type: true,
  text: true,
  explanation: true,
  options: {
    orderBy: { order: "asc" as const },
    select: { id: true, order: true, text: true, isCorrect: true },
  },
};

const quizSelect = {
  id: true,
  passMarkPercent: true,
  attemptLimit: true,
  waitMinutes: true,
  questions: {
    where: { deletedAt: null },
    orderBy: { order: "asc" as const },
    select: questionSelect,
  },
};

interface QuestionRow {
  id: string;
  order: number;
  type: QuestionType;
  text: string;
  explanation: string | null;
  options: Array<{ id: string; order: number; text: string; isCorrect: boolean }>;
}

interface QuizRow {
  id: string;
  passMarkPercent: number;
  attemptLimit: number | null;
  waitMinutes: number;
  questions: QuestionRow[];
}

const rulesOf = (row: QuizRow): QuizRulesRequest => ({
  passMarkPercent: row.passMarkPercent,
  attemptLimit: row.attemptLimit,
  waitMinutes: row.waitMinutes,
});

const toQuestionSummary = (row: QuestionRow): QuizQuestionSummary => ({
  id: row.id,
  order: row.order,
  type: row.type,
  text: row.text,
  explanation: row.explanation,
  options: row.options.map(({ id, order, text, isCorrect }) => ({ id, order, text, isCorrect })),
});

const optionRequestsOf = (row: QuestionRow): QuizOptionRequest[] =>
  row.options.map(({ text, isCorrect }) => ({ text, isCorrect }));

const auditedQuestion = (moduleId: string, row: QuestionRow) => ({
  moduleId,
  order: row.order,
  type: row.type,
  text: row.text,
  explanation: row.explanation,
  options: row.options.map(({ order, text, isCorrect }) => ({ order, text, isCorrect })),
});

const optionData = (options: readonly QuizOptionRequest[]) =>
  options.map((option, index) => ({
    order: index + 1,
    text: option.text,
    isCorrect: option.isCorrect,
  }));

@Injectable()
export class QuizService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly audit: AuditService,
  ) {}

  async get(courseId: string, moduleId: string): Promise<QuizSummary> {
    const scope = await readScope(this.database, courseId);
    await this.assertModule(this.database, scope.revisionId, moduleId);
    return this.viewOf(this.database, moduleId, scope.lockedAt !== null);
  }

  async updateRules(
    courseId: string,
    moduleId: string,
    request: QuizRulesRequest,
  ): Promise<QuizSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    const existing = await this.findQuiz(client, moduleId);
    if (existing === null) {
      assertContentUnlocked(scope.lockedAt);
      const created = await client.quiz.create({
        data: { moduleId, ...request },
        select: quizSelect,
      });
      this.audit.capture({
        entityId: created.id,
        after: { moduleId, ...rulesOf(created) },
      });
      return this.viewOf(client, moduleId, false);
    }
    const before = rulesOf(existing);
    assertRulesUnlocked(scope.lockedAt, before, request);
    const updated = await client.quiz.update({
      where: { id: existing.id },
      data: request,
      select: quizSelect,
    });
    this.audit.capture({
      entityId: existing.id,
      before: { moduleId, ...before },
      after: { moduleId, ...rulesOf(updated) },
    });
    return this.viewOf(client, moduleId, scope.lockedAt !== null);
  }

  async createQuestion(
    courseId: string,
    moduleId: string,
    request: QuizQuestionRequest,
  ): Promise<QuizSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const quizId = await this.ensureQuiz(client, moduleId);
    const highest = await client.question.aggregate({
      where: { quizId, deletedAt: null },
      _max: { order: true },
    });
    const created = await client.question.create({
      data: {
        quizId,
        order: nextOrder(highest._max.order),
        type: request.type,
        text: request.text,
        explanation: request.explanation,
        options: { create: optionData(request.options) },
      },
      select: questionSelect,
    });
    this.audit.capture({ entityId: created.id, after: auditedQuestion(moduleId, created) });
    return this.viewOf(client, moduleId, false);
  }

  async updateQuestion(
    courseId: string,
    moduleId: string,
    questionId: string,
    request: UpdateQuizQuestionRequest,
  ): Promise<QuizSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    await this.assertModule(client, scope.revisionId, moduleId);
    const before = await this.existing(client, moduleId, questionId);
    const currentOptions = optionRequestsOf(before);
    assertOptionsUnlocked(scope.lockedAt, currentOptions, request.options);
    if (scope.lockedAt === null) {
      await this.replaceOptions(client, questionId, currentOptions, request.options);
    }
    const updated = await client.question.update({
      where: { id: questionId },
      data: { text: request.text, explanation: request.explanation },
      select: questionSelect,
    });
    this.audit.capture({
      entityId: questionId,
      before: auditedQuestion(moduleId, before),
      after: auditedQuestion(moduleId, updated),
    });
    return this.viewOf(client, moduleId, scope.lockedAt !== null);
  }

  async removeQuestion(
    courseId: string,
    moduleId: string,
    questionId: string,
  ): Promise<QuizSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const before = await this.existing(client, moduleId, questionId);
    await client.option.deleteMany({ where: { questionId } });
    await client.question.delete({ where: { id: questionId } });
    const remaining = await this.orderedIds(client, moduleId);
    await applyOrderPlan(planResequence(remaining), (step) =>
      client.question.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({ entityId: questionId, before: auditedQuestion(moduleId, before) });
    return this.viewOf(client, moduleId, false);
  }

  async reorderQuestions(
    courseId: string,
    moduleId: string,
    request: ReorderRequest,
  ): Promise<QuizSummary> {
    const client = this.audit.client(this.database);
    const scope = await lockScope(client as ContentLocker, courseId);
    assertContentUnlocked(scope.lockedAt);
    await this.assertModule(client, scope.revisionId, moduleId);
    const current = await this.orderedIds(client, moduleId);
    const plan = planReorder(current, request);
    await applyOrderPlan(plan, (step) =>
      client.question.update({ where: { id: step.id }, data: { order: step.order } }),
    );
    this.audit.capture({
      entityId: moduleId,
      before: { questionIds: current },
      after: { questionIds: request.orderedIds },
    });
    return this.viewOf(client, moduleId, false);
  }

  private async replaceOptions(
    client: QuizClient,
    questionId: string,
    current: readonly QuizOptionRequest[],
    next: readonly QuizOptionRequest[],
  ): Promise<void> {
    const unchanged =
      current.length === next.length &&
      current.every(
        (option, index) =>
          option.text === next[index]?.text && option.isCorrect === next[index]?.isCorrect,
      );
    if (unchanged) return;
    await client.option.deleteMany({ where: { questionId } });
    await client.option.createMany({
      data: optionData(next).map((option) => ({ ...option, questionId })),
    });
  }

  private async viewOf(
    client: QuizClient,
    moduleId: string,
    locked: boolean,
  ): Promise<QuizSummary> {
    const row = await this.findQuiz(client, moduleId);
    if (row === null) {
      return {
        id: null,
        rules: { ...quizDefaults, attemptLimit: await this.defaultAttemptLimit(client) },
        questions: [],
        locked,
      };
    }
    return {
      id: row.id,
      rules: rulesOf(row),
      questions: row.questions.map(toQuestionSummary),
      locked,
    };
  }

  private findQuiz(client: QuizClient, moduleId: string): Promise<QuizRow | null> {
    return client.quiz.findFirst({
      where: { moduleId, deletedAt: null },
      select: quizSelect,
    });
  }

  private async ensureQuiz(client: QuizClient, moduleId: string): Promise<string> {
    const existing = await this.findQuiz(client, moduleId);
    if (existing !== null) return existing.id;
    const created = await client.quiz.create({
      data: { moduleId, attemptLimit: await this.defaultAttemptLimit(client) },
      select: { id: true },
    });
    return created.id;
  }

  private async defaultAttemptLimit(client: QuizClient): Promise<number | null> {
    const row = await client.siteSetting.findUnique({
      where: { key: quizSettingsKey },
      select: { value: true },
    });
    return readStoredQuizSettings(row?.value).attemptLimit;
  }

  private async assertModule(
    client: Pick<HeatClient, "module">,
    revisionId: string,
    moduleId: string,
  ): Promise<void> {
    const row = await client.module.findFirst({
      where: { id: moduleId, revisionId, deletedAt: null },
      select: { id: true },
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
  }

  private async existing(
    client: QuizClient,
    moduleId: string,
    questionId: string,
  ): Promise<QuestionRow> {
    const row = await client.question.findFirst({
      where: { id: questionId, deletedAt: null, quiz: { moduleId, deletedAt: null } },
      select: questionSelect,
    });
    if (row === null) throw new ApiException(404, "NOT_FOUND");
    return row;
  }

  private async orderedIds(client: QuizClient, moduleId: string): Promise<string[]> {
    const rows = await client.question.findMany({
      where: { deletedAt: null, quiz: { moduleId, deletedAt: null } },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
