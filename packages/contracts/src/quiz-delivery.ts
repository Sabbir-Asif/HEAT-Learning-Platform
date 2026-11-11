import { z } from "zod";

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

const attemptCountsShape = {
  attemptsUsed: z.number().int().min(0),
  attemptsAllowed: z.number().int().min(0).nullable(),
};

export const quizDeliveryAvailableSchema = z.object({
  status: z.literal("AVAILABLE"),
  ...attemptCountsShape,
  quiz: z.object({ id: z.uuid(), passMarkPercent: z.number().int().min(0).max(100) }),
  attempt: z.object({ id: z.uuid(), startedAt: z.iso.datetime() }),
  questions: z.array(quizDeliveryQuestionSchema),
});

export const quizDeliveryWaitingSchema = z.object({
  status: z.literal("WAITING"),
  ...attemptCountsShape,
  nextAttemptAt: z.iso.datetime(),
});

export const quizDeliveryExhaustedSchema = z.object({
  status: z.literal("EXHAUSTED"),
  ...attemptCountsShape,
});

export const quizPastResultSchema = z.object({
  attemptId: z.uuid(),
  scorePercent: z.number().int().min(0).max(100),
  passed: z.boolean(),
  submittedAt: z.iso.datetime(),
});

export const quizDeliveryPassedSchema = z.object({
  status: z.literal("PASSED"),
  ...attemptCountsShape,
  passMarkPercent: z.number().int().min(0).max(100),
  bestResult: quizPastResultSchema.nullable(),
});

export const quizDeliveryResponseSchema = z.discriminatedUnion("status", [
  quizDeliveryAvailableSchema,
  quizDeliveryWaitingSchema,
  quizDeliveryExhaustedSchema,
  quizDeliveryPassedSchema,
]);

export type QuizDeliveryQuestion = z.infer<typeof quizDeliveryQuestionSchema>;
export type QuizPastResult = z.infer<typeof quizPastResultSchema>;
export type QuizDeliveryResponse = z.infer<typeof quizDeliveryResponseSchema>;
