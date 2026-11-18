import { z } from "zod";
import { quizDefaults } from "./quizzes";

export const quizSettingsKey = "quiz-defaults";

export const quizSettingsRequestSchema = z.object({
  attemptLimit: z
    .number()
    .int("Use a whole number.")
    .min(1, "Allow at least 1 attempt, or leave it unlimited.")
    .max(1000, "Use at most 1000 attempts, or leave it unlimited.")
    .nullable(),
});

export type QuizSettingsRequest = z.infer<typeof quizSettingsRequestSchema>;

export const emptyQuizSettings: QuizSettingsRequest = { attemptLimit: quizDefaults.attemptLimit };

export const adminQuizSettingsResponseSchema = z.object({
  attemptLimit: z.number().int().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});

export type AdminQuizSettingsResponse = z.infer<typeof adminQuizSettingsResponseSchema>;
