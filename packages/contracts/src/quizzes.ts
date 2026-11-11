import { z } from "zod";

export const quizQuestionTextMaxLength = 1000;
export const quizExplanationMaxLength = 2000;
export const quizOptionMaxLength = 300;
export const quizOptionMinCount = 2;
export const quizOptionMaxCount = 6;
export const quizWaitMaxMinutes = 10080;

export const quizDefaults = {
  passMarkPercent: 70,
  attemptLimit: null,
  waitMinutes: 10,
} as const;

const hiddenCharacters = /[\p{Cc}\p{Cf}]/u;

const noHiddenCharacters = (value: string) => !hiddenCharacters.test(value);

const hiddenMessage = "Remove control, invisible or text direction characters.";

export const questionTypeSchema = z.enum(["SINGLE_CHOICE"]);

export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionTextSchema = z
  .string()
  .trim()
  .min(1, "Enter the question.")
  .max(quizQuestionTextMaxLength, `Use at most ${quizQuestionTextMaxLength} characters.`)
  .refine((value) => !hiddenCharacters.test(value.replace(/\n/g, "")), hiddenMessage);

export const questionOptionTextSchema = z
  .string()
  .trim()
  .min(1, "Enter the option or remove it.")
  .max(quizOptionMaxLength, `Use at most ${quizOptionMaxLength} characters.`)
  .refine(noHiddenCharacters, hiddenMessage);

export const questionExplanationSchema = z
  .string()
  .trim()
  .max(quizExplanationMaxLength, `Use at most ${quizExplanationMaxLength} characters.`)
  .refine((value) => !hiddenCharacters.test(value.replace(/\n/g, "")), hiddenMessage);

export const quizOptionRequestSchema = z.object({
  text: questionOptionTextSchema,
  isCorrect: z.boolean(),
});

export type QuizOptionRequest = z.infer<typeof quizOptionRequestSchema>;

const oneCorrectOption = (options: QuizOptionRequest[]) =>
  options.filter((option) => option.isCorrect).length === 1;

export const quizOptionsSchema = z
  .array(quizOptionRequestSchema)
  .min(quizOptionMinCount, `Add at least ${quizOptionMinCount} options.`)
  .max(quizOptionMaxCount, `Use at most ${quizOptionMaxCount} options.`)
  .refine(oneCorrectOption, "Mark exactly one option as correct.");

export const updateQuizQuestionRequestSchema = z.object({
  text: questionTextSchema,
  explanation: questionExplanationSchema
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null),
  options: quizOptionsSchema,
});

export type UpdateQuizQuestionRequest = z.infer<typeof updateQuizQuestionRequestSchema>;

export const quizQuestionRequestSchema = updateQuizQuestionRequestSchema.extend({
  type: questionTypeSchema.default("SINGLE_CHOICE"),
});

export type QuizQuestionRequest = z.infer<typeof quizQuestionRequestSchema>;

export const questionFormSchema = z
  .object({
    text: questionTextSchema,
    explanation: questionExplanationSchema,
    options: z
      .array(z.object({ text: questionOptionTextSchema }))
      .min(quizOptionMinCount, `Add at least ${quizOptionMinCount} options.`)
      .max(quizOptionMaxCount, `Use at most ${quizOptionMaxCount} options.`),
    correct: z.string(),
  })
  .refine((value) => /^\d+$/.test(value.correct) && Number(value.correct) < value.options.length, {
    path: ["correct"],
    message: "Choose the correct option.",
  });

export type QuestionFormValues = z.infer<typeof questionFormSchema>;

export const questionRequestOf = (
  values: QuestionFormValues,
): { text: string; explanation: string; options: QuizOptionRequest[] } => ({
  text: values.text,
  explanation: values.explanation,
  options: values.options.map((option, index) => ({
    text: option.text,
    isCorrect: String(index) === values.correct,
  })),
});

const passMarkSchema = z
  .number()
  .int("Use a whole number.")
  .min(1, "Use a pass mark from 1 to 100.")
  .max(100, "Use a pass mark from 1 to 100.");

const attemptLimitSchema = z
  .number()
  .int("Use a whole number.")
  .min(1, "Allow at least 1 attempt, or leave it unlimited.")
  .nullable();

const waitMinutesSchema = z
  .number()
  .int("Use a whole number.")
  .min(0, "The wait cannot be negative.")
  .max(quizWaitMaxMinutes, `Use at most ${quizWaitMaxMinutes} minutes.`);

export const quizRulesRequestSchema = z.object({
  passMarkPercent: passMarkSchema,
  attemptLimit: attemptLimitSchema,
  waitMinutes: waitMinutesSchema,
});

export type QuizRulesRequest = z.infer<typeof quizRulesRequestSchema>;

export const quizOptionSummarySchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  text: z.string(),
  isCorrect: z.boolean(),
});

export type QuizOptionSummary = z.infer<typeof quizOptionSummarySchema>;

export const quizQuestionSummarySchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  type: questionTypeSchema,
  text: z.string(),
  explanation: z.string().max(quizExplanationMaxLength).nullable(),
  options: z.array(quizOptionSummarySchema),
});

export type QuizQuestionSummary = z.infer<typeof quizQuestionSummarySchema>;

export const quizSummarySchema = z.object({
  id: z.uuid().nullable(),
  rules: quizRulesRequestSchema,
  questions: z.array(quizQuestionSummarySchema),
  locked: z.boolean(),
});

export type QuizSummary = z.infer<typeof quizSummarySchema>;

export const quizQuestionParamsSchema = z.object({
  id: z.uuid(),
  moduleId: z.uuid(),
  questionId: z.uuid(),
});
