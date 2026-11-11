import { z } from "zod";

export const progressMaxVideoSeconds = 86400;
export const progressMaxIntervalsPerBatch = 64;
export const progressMaxSequence = 2147483647;
export const progressHeartbeatSeconds = 15;

const progressSecondsSchema = z.number().min(0).max(progressMaxVideoSeconds);

export const watchedIntervalSchema = z
  .object({ start: progressSecondsSchema, end: progressSecondsSchema })
  .refine((interval) => interval.end > interval.start, { path: ["end"] });

export const watchedIntervalsSchema = z.array(watchedIntervalSchema);

export const progressBatchSchema = z.object({
  sessionId: z.uuid(),
  sequence: z.number().int().min(1).max(progressMaxSequence),
  positionSeconds: progressSecondsSchema,
  intervals: z.array(watchedIntervalSchema).max(progressMaxIntervalsPerBatch),
  csrfToken: z.string().min(1).max(512).optional(),
});

export const progressResponseSchema = z.object({
  coveragePercent: z.number().int().min(0).max(100),
  resumePositionSeconds: z.number().int().min(0),
  completed: z.boolean(),
});

export type WatchedInterval = z.infer<typeof watchedIntervalSchema>;
export type ProgressBatch = z.infer<typeof progressBatchSchema>;
export type ProgressResponse = z.infer<typeof progressResponseSchema>;
