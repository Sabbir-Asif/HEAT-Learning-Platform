import { z } from "zod";
import { enrollmentStatusSchema } from "./auth";
import { courseRevisionItemSchema } from "./courses";
import { quizExplanationMaxLength } from "./quizzes";
import { lessonBodyImageSchema } from "./rich-text";
import { videoSlotStatusSchema } from "./videos";

export const revisionSnapshotStudentLimit = 100;

export const revisionSnapshotSectionSchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
  body: z.record(z.string(), z.unknown()),
  images: z.array(lessonBodyImageSchema),
});

export const revisionSnapshotVideoSchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
  required: z.boolean(),
  status: videoSlotStatusSchema,
});

export const revisionSnapshotOptionSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  isCorrect: z.boolean(),
});

export const revisionSnapshotQuestionSchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  text: z.string(),
  explanation: z.string().max(quizExplanationMaxLength).nullable(),
  options: z.array(revisionSnapshotOptionSchema),
});

export const revisionSnapshotQuizSchema = z.object({
  passMarkPercent: z.number().int(),
  attemptLimit: z.number().int().nullable(),
  waitMinutes: z.number().int(),
  questions: z.array(revisionSnapshotQuestionSchema),
});

export const revisionSnapshotModuleSchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
  objectives: z.array(z.string()),
  sections: z.array(revisionSnapshotSectionSchema),
  videos: z.array(revisionSnapshotVideoSchema),
  quiz: revisionSnapshotQuizSchema.nullable(),
});

export const revisionSnapshotStudentSchema = z.object({
  enrollmentId: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  status: enrollmentStatusSchema,
});

export const revisionSnapshotResponseSchema = z.object({
  revision: courseRevisionItemSchema,
  modules: z.array(revisionSnapshotModuleSchema),
  students: z.object({
    total: z.number().int().min(0),
    items: z.array(revisionSnapshotStudentSchema),
  }),
});

export type RevisionSnapshotResponse = z.infer<typeof revisionSnapshotResponseSchema>;
