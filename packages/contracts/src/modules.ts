import { z } from "zod";
import { courseTitleSchema } from "./courses";

export const moduleObjectiveMaxLength = 200;
export const moduleObjectiveMaxCount = 10;

const hiddenCharacters = /[\p{Cc}\p{Cf}]/u;

export const moduleObjectiveSchema = z
  .string()
  .trim()
  .transform((value) => value.normalize("NFC").replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter the objective or remove the row.")
      .max(moduleObjectiveMaxLength, `Use at most ${moduleObjectiveMaxLength} characters.`)
      .refine(
        (value) => !hiddenCharacters.test(value),
        "Remove control, invisible or text direction characters.",
      ),
  );

export const moduleObjectivesSchema = z
  .array(moduleObjectiveSchema)
  .max(moduleObjectiveMaxCount, `Add at most ${moduleObjectiveMaxCount} objectives.`);

export const createModuleRequestSchema = z.object({
  title: courseTitleSchema,
  objectives: moduleObjectivesSchema.default([]),
});

export type CreateModuleRequest = z.infer<typeof createModuleRequestSchema>;

export const updateModuleRequestSchema = createModuleRequestSchema;

export type UpdateModuleRequest = CreateModuleRequest;

export const moduleFormSchema = z.object({
  title: courseTitleSchema,
  objectives: z.array(z.object({ text: moduleObjectiveSchema })).max(moduleObjectiveMaxCount),
});

export type ModuleFormValues = z.infer<typeof moduleFormSchema>;

export const lessonSectionRequestSchema = z.object({ title: courseTitleSchema });

export type LessonSectionRequest = z.infer<typeof lessonSectionRequestSchema>;

export const lessonSectionSummarySchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
});

export type LessonSectionSummary = z.infer<typeof lessonSectionSummarySchema>;

export const moduleSummarySchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
  objectives: z.array(z.string()),
  sections: z.array(lessonSectionSummarySchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ModuleSummary = z.infer<typeof moduleSummarySchema>;

export const moduleListResponseSchema = z.object({
  items: z.array(moduleSummarySchema),
  locked: z.boolean(),
});

export type ModuleListResponse = z.infer<typeof moduleListResponseSchema>;

export const reorderRequestSchema = z
  .object({
    previousIds: z.array(z.uuid()).max(500),
    orderedIds: z.array(z.uuid()).max(500),
  })
  .refine((value) => new Set(value.orderedIds).size === value.orderedIds.length, {
    path: ["orderedIds"],
    message: "Each item can appear once.",
  });

export type ReorderRequest = z.infer<typeof reorderRequestSchema>;

export const moduleParamsSchema = z.object({ id: z.uuid(), moduleId: z.uuid() });

export const lessonSectionParamsSchema = z.object({
  id: z.uuid(),
  moduleId: z.uuid(),
  sectionId: z.uuid(),
});
