import { z } from "zod";
import { approvalReasonMaxLength } from "./approvals";

export const videoCompletionThreshold = 0.8;

export const learningModuleStateSchema = z.enum([
  "LOCKED",
  "UNLOCKED",
  "IN_PROGRESS",
  "QUIZ_READY",
  "COMPLETED",
]);

export type LearningModuleState = z.infer<typeof learningModuleStateSchema>;

export const learningVideoStatusSchema = z.enum([
  "UNAVAILABLE",
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
]);

export type LearningVideoStatus = z.infer<typeof learningVideoStatusSchema>;

export const learningQuizAvailabilitySchema = z.enum([
  "UNAVAILABLE",
  "AVAILABLE",
  "WAITING",
  "EXHAUSTED",
  "PASSED",
]);

export type LearningQuizAvailability = z.infer<typeof learningQuizAvailabilitySchema>;

export const learningStructureParamsSchema = z.object({ courseId: z.uuid() });

export const learningVideoSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  title: z.string(),
  required: z.boolean(),
  durationSeconds: z.number().int().min(0).nullable(),
  status: learningVideoStatusSchema,
  coveragePercent: z.number().int().min(0).max(100),
  resumePositionSeconds: z.number().int().min(0),
});

export const learningLessonSectionSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  title: z.string(),
});

export const learningQuizSchema = z.object({
  id: z.uuid(),
  availability: learningQuizAvailabilitySchema,
  questionCount: z.number().int().min(0),
  passMarkPercent: z.number().int().min(0).max(100),
  attemptsUsed: z.number().int().min(0),
  attemptsAllowed: z.number().int().min(0).nullable(),
  nextAttemptAt: z.iso.datetime().nullable(),
});

export const learningModuleSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  title: z.string(),
  objectives: z.array(z.string()),
  state: learningModuleStateSchema,
  requiredVideosCompleted: z.number().int().min(0),
  requiredVideosTotal: z.number().int().min(0),
  lessonSections: z.array(learningLessonSectionSchema),
  videos: z.array(learningVideoSchema),
  quiz: learningQuizSchema.nullable(),
});

export const learningEnrollmentStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "PENDING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "REMOVED",
]);

export type LearningEnrollmentStatus = z.infer<typeof learningEnrollmentStatusSchema>;

export const learningContentSchema = z.object({
  revision: z.object({ id: z.uuid(), number: z.number().int() }),
  summary: z.object({
    overallProgressPercent: z.number().int().min(0).max(100),
    modulesCompleted: z.number().int().min(0),
    modulesTotal: z.number().int().min(0),
    nextModuleId: z.uuid().nullable(),
  }),
  modules: z.array(learningModuleSchema),
});

export const learningStructureResponseSchema = z.object({
  course: z.object({ id: z.uuid(), slug: z.string(), title: z.string() }),
  enrollment: z.object({
    status: learningEnrollmentStatusSchema,
    reason: z.string().max(approvalReasonMaxLength).nullable(),
  }),
  learning: learningContentSchema.nullable(),
});

export type LearningContent = z.infer<typeof learningContentSchema>;
export type LearningStructureResponse = z.infer<typeof learningStructureResponseSchema>;

export const lessonContentParamsSchema = z.object({ courseId: z.uuid(), moduleId: z.uuid() });

export const lessonContentSectionSchema = z.object({
  id: z.uuid(),
  order: z.number().int(),
  title: z.string(),
  schemaVersion: z.number().int(),
  body: z.record(z.string(), z.unknown()),
});

export const lessonContentResponseSchema = z.object({
  module: z.object({ id: z.uuid(), title: z.string(), objectives: z.array(z.string()) }),
  sections: z.array(lessonContentSectionSchema),
});

export type LessonContentSection = z.infer<typeof lessonContentSectionSchema>;
export type LessonContentResponse = z.infer<typeof lessonContentResponseSchema>;

export const quizAccessParamsSchema = z.object({ courseId: z.uuid(), moduleId: z.uuid() });

export const quizAccessResponseSchema = z.object({ moduleState: learningModuleStateSchema });

export type QuizAccessResponse = z.infer<typeof quizAccessResponseSchema>;
