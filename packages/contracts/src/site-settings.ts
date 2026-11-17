import { z } from "zod";
import { lessonBodyImageSchema, richTextBodySchema, richTextSchemaVersion } from "./rich-text";

export const landingOverviewKey = "landing-overview";
export const landingOverviewHeadingMaxLength = 120;

export const landingOverviewHeadingSchema = z
  .string()
  .trim()
  .min(1, "Enter the heading.")
  .max(
    landingOverviewHeadingMaxLength,
    `Use at most ${landingOverviewHeadingMaxLength} characters.`,
  );

export const landingOverviewRequestSchema = z.object({
  heading: landingOverviewHeadingSchema,
  schemaVersion: z.literal(richTextSchemaVersion),
  body: richTextBodySchema,
  imageAssetId: z.uuid().nullable(),
});

export type LandingOverviewRequest = z.infer<typeof landingOverviewRequestSchema>;

export const landingOverviewFormSchema = z.object({ heading: landingOverviewHeadingSchema });

export type LandingOverviewFormValues = z.infer<typeof landingOverviewFormSchema>;

const landingOverviewContent = {
  heading: z.string(),
  schemaVersion: z.number().int().min(1),
  body: z.record(z.string(), z.unknown()),
  imageAssetId: z.uuid().nullable(),
  image: lessonBodyImageSchema.nullable(),
  images: z.array(lessonBodyImageSchema),
};

export const adminLandingOverviewResponseSchema = z.object({
  ...landingOverviewContent,
  updatedAt: z.iso.datetime().nullable(),
});

export type AdminLandingOverviewResponse = z.infer<typeof adminLandingOverviewResponseSchema>;

export const publicLandingOverviewResponseSchema = z.object(landingOverviewContent);

export type PublicLandingOverviewResponse = z.infer<typeof publicLandingOverviewResponseSchema>;
