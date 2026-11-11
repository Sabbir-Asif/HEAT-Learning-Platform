import type { QuizSubmitRequest, QuizSubmitResponse } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE } from "../core";
import { ApiException } from "../http/api-exception";
import { QuizGateService } from "./quiz-gate";
import { QUIZ_SCORED_HANDLERS } from "./quiz-scored-handler";
import type { QuizScoredHandler, QuizScoringTransaction } from "./quiz-scored-handler";
import {
  answersAreValid,
  correctCountOf,
  scoreOf,
  submissionEligibility,
} from "./quiz-submission-rules";
import type { ScoredQuizAttempt } from "./quiz-submission-rules";

const toResponse = (result: ScoredQuizAttempt): QuizSubmitResponse => ({
  attemptId: result.attemptId,
  scorePercent: result.scorePercent,
  passed: result.passed,
  passMarkPercent: result.passMarkPercent,
  correctCount: result.correctCount,
  totalQuestions: result.totalQuestions,
});

@Injectable()
export class QuizSubmissionService {
  constructor(
    @Inject(DATABASE) private readonly database: HeatClient,
    private readonly gate: QuizGateService,
    @Inject(QUIZ_SCORED_HANDLERS) private readonly handlers: readonly QuizScoredHandler[],
  ) {}

  async submit(
    userId: string,
    courseId: string,
    moduleId: string,
    request: QuizSubmitRequest,
  ): Promise<QuizSubmitResponse> {
    const state = await this.gate.requireUnlocked(userId, courseId, moduleId);
    const result = await this.database.$transaction((tx) =>
      this.score(tx, userId, courseId, moduleId, request, state === "COMPLETED"),
    );
    return toResponse(result);
  }

  private async score(
    tx: QuizScoringTransaction,
    userId: string,
    courseId: string,
    moduleId: string,
    request: QuizSubmitRequest,
    moduleCompleted: boolean,
  ): Promise<ScoredQuizAttempt> {
    const enrollment = await tx.enrollment.findFirst({
      where: { userId, courseId, deletedAt: null },
      select: { id: true },
    });
    if (enrollment === null) throw new ApiException(403, "ENROLLMENT_NOT_ACTIVE");
    await tx.$queryRaw`SELECT id FROM "Enrollment" WHERE id = ${enrollment.id}::uuid FOR UPDATE`;
    const quiz = await tx.quiz.findFirst({
      where: { moduleId, deletedAt: null },
      select: {
        id: true,
        attemptLimit: true,
        waitMinutes: true,
        questions: {
          where: { deletedAt: null },
          select: { id: true, options: { select: { id: true, isCorrect: true } } },
        },
      },
    });
    if (quiz === null) throw new NotFoundException();
    const attempt = await tx.quizAttempt.findFirst({
      where: { id: request.attemptId, enrollmentId: enrollment.id, quizId: quiz.id },
      select: { id: true, idempotencyKey: true, passMarkSnapshot: true, submittedAt: true },
    });
    if (attempt === null) throw new NotFoundException();
    if (attempt.submittedAt !== null) {
      if (attempt.idempotencyKey !== request.idempotencyKey) {
        throw new ApiException(409, "QUIZ_ATTEMPT_NOT_OPEN");
      }
      return this.replay(tx, attempt.id, attempt.passMarkSnapshot, quiz.questions);
    }
    if (moduleCompleted) throw new ApiException(409, "QUIZ_ATTEMPT_NOT_OPEN");
    const [submitted, grants] = await Promise.all([
      tx.quizAttempt.findMany({
        where: { enrollmentId: enrollment.id, quizId: quiz.id, submittedAt: { not: null } },
        select: { passed: true, submittedAt: true },
      }),
      tx.attemptGrant.findMany({
        where: { enrollmentId: enrollment.id, quizId: quiz.id },
        select: { extraAttempts: true },
      }),
    ]);
    const eligibility = submissionEligibility(
      {
        attemptLimit: quiz.attemptLimit,
        waitMinutes: quiz.waitMinutes,
        extraAttempts: grants.reduce((sum, grant) => sum + grant.extraAttempts, 0),
        attempts: submitted.flatMap((row) =>
          row.submittedAt === null ? [] : [{ passed: row.passed, submittedAt: row.submittedAt }],
        ),
      },
      new Date(),
    );
    if (eligibility.kind === "ALREADY_PASSED") throw new ApiException(409, "QUIZ_ATTEMPT_NOT_OPEN");
    if (eligibility.kind === "LIMIT_REACHED") {
      throw new ApiException(409, "QUIZ_ATTEMPT_LIMIT_REACHED");
    }
    if (eligibility.kind === "WAIT") {
      throw new ApiException(
        409,
        "QUIZ_ATTEMPT_WAIT",
        Math.max(1, Math.ceil((eligibility.nextAttemptAt.getTime() - Date.now()) / 1000)),
        undefined,
        undefined,
        undefined,
        { nextAttemptAt: eligibility.nextAttemptAt.toISOString() },
      );
    }
    if (!answersAreValid(quiz.questions, request.answers)) {
      throw new ApiException(400, "QUIZ_ANSWER_INVALID");
    }
    const score = scoreOf(
      correctCountOf(quiz.questions, request.answers),
      quiz.questions.length,
      attempt.passMarkSnapshot,
    );
    await tx.answer.createMany({
      data: Object.entries(request.answers).map(([questionId, optionId]) => ({
        attemptId: attempt.id,
        questionId,
        optionId,
      })),
    });
    await tx.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        idempotencyKey: request.idempotencyKey,
        scorePercent: score.scorePercent,
        passed: score.passed,
        submittedAt: new Date(),
      },
    });
    const result: ScoredQuizAttempt = {
      ...score,
      attemptId: attempt.id,
      passMarkPercent: attempt.passMarkSnapshot,
    };
    for (const handler of this.handlers) {
      await handler.onQuizScored({
        tx,
        userId,
        courseId,
        moduleId,
        enrollmentId: enrollment.id,
        quizId: quiz.id,
        result,
      });
    }
    return result;
  }

  private async replay(
    tx: QuizScoringTransaction,
    attemptId: string,
    passMarkPercent: number,
    questions: readonly { id: string; options: readonly { id: string; isCorrect: boolean }[] }[],
  ): Promise<ScoredQuizAttempt> {
    const rows = await tx.answer.findMany({
      where: { attemptId },
      select: { questionId: true, optionId: true },
    });
    const answers = Object.fromEntries(rows.map((row) => [row.questionId, row.optionId]));
    return {
      ...scoreOf(correctCountOf(questions, answers), questions.length, passMarkPercent),
      attemptId,
      passMarkPercent,
    };
  }
}
