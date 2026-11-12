import { z } from "zod";

export const maxQuizAnswers = 500;

export const quizDeliveryParamsSchema = z.object({ courseId: z.uuid(), moduleId: z.uuid() });

export const quizDeliveryOptionSchema = z.object({
  id: z.uuid(),
  text: z.string(),
});

export const quizDeliveryQuestionSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  text: z.string(),
  options: z.array(quizDeliveryOptionSchema),
});

export const quizDeliveryStatusSchema = z.enum(["AVAILABLE", "WAITING", "EXHAUSTED", "PASSED"]);

export const quizPastResultSchema = z.object({
  attemptId: z.uuid(),
  scorePercent: z.number().int().min(0).max(100),
  passed: z.boolean(),
  submittedAt: z.iso.datetime(),
});

export const quizDeliveryResponseSchema = z.object({
  status: quizDeliveryStatusSchema,
  attemptsUsed: z.number().int().min(0),
  attemptsAllowed: z.number().int().min(0).nullable(),
  quiz: z.object({ id: z.uuid(), passMarkPercent: z.number().int().min(0).max(100) }).nullable(),
  attempt: z.object({ id: z.uuid(), startedAt: z.iso.datetime() }).nullable(),
  questions: z.array(quizDeliveryQuestionSchema),
  nextAttemptAt: z.iso.datetime().nullable(),
  bestResult: quizPastResultSchema.nullable(),
});

export type QuizDeliveryStatus = z.infer<typeof quizDeliveryStatusSchema>;
export type QuizDeliveryQuestion = z.infer<typeof quizDeliveryQuestionSchema>;
export type QuizPastResult = z.infer<typeof quizPastResultSchema>;
export type QuizDeliveryResponse = z.infer<typeof quizDeliveryResponseSchema>;

export const quizAnswersSchema = z
  .record(z.uuid(), z.uuid())
  .refine((answers) => Object.keys(answers).length <= maxQuizAnswers);

export const quizSubmitRequestSchema = z.object({
  attemptId: z.uuid(),
  idempotencyKey: z.uuid(),
  answers: quizAnswersSchema,
});

export const quizSubmitResponseSchema = z.object({
  attemptId: z.uuid(),
  scorePercent: z.number().int().min(0).max(100),
  passed: z.boolean(),
  passMarkPercent: z.number().int().min(0).max(100),
  correctCount: z.number().int().min(0),
  totalQuestions: z.number().int().min(0),
});

export type QuizAnswers = z.infer<typeof quizAnswersSchema>;
export type QuizSubmitRequest = z.infer<typeof quizSubmitRequestSchema>;
export type QuizSubmitResponse = z.infer<typeof quizSubmitResponseSchema>;
