import { emptyQuizSettings, quizSettingsRequestSchema } from "@heat/contracts";
import type { QuizSettingsRequest } from "@heat/contracts";

export const readStoredQuizSettings = (value: unknown): QuizSettingsRequest => {
  const parsed = quizSettingsRequestSchema.safeParse(value);
  return parsed.success ? parsed.data : emptyQuizSettings;
};
