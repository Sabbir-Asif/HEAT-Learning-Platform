import { z } from "zod";
import { courseTitleSchema } from "./courses";

export const videoSlotStatusSchema = z.enum([
  "NOT_UPLOADED",
  "UPLOADING",
  "UPLOADED",
  "QUEUED",
  "PROCESSING",
  "READY",
  "FAILED",
  "REJECTED",
]);

export type VideoSlotStatus = z.infer<typeof videoSlotStatusSchema>;

export const createVideoSlotRequestSchema = z.object({
  title: courseTitleSchema,
  required: z.boolean().default(true),
});

export type CreateVideoSlotRequest = z.infer<typeof createVideoSlotRequestSchema>;

export const updateVideoSlotRequestSchema = z.object({
  title: courseTitleSchema,
  required: z.boolean(),
});

export type UpdateVideoSlotRequest = z.infer<typeof updateVideoSlotRequestSchema>;

export const videoSlotSummarySchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
  required: z.boolean(),
  status: videoSlotStatusSchema,
  assetKey: z.string().nullable(),
});

export type VideoSlotSummary = z.infer<typeof videoSlotSummarySchema>;

export const videoSlotListResponseSchema = z.object({
  items: z.array(videoSlotSummarySchema),
  locked: z.boolean(),
});

export type VideoSlotListResponse = z.infer<typeof videoSlotListResponseSchema>;

export const videoSlotParamsSchema = z.object({
  id: z.uuid(),
  moduleId: z.uuid(),
  videoId: z.uuid(),
});
