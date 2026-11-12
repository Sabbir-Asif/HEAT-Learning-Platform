import { z } from "zod";
import { adminPageSizes } from "./admins";
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

export const videoPollIntervalMs = 5000;

const finalVideoStatuses: readonly VideoSlotStatus[] = [
  "NOT_UPLOADED",
  "READY",
  "FAILED",
  "REJECTED",
];

export const videoStatusIsFinal = (status: VideoSlotStatus): boolean =>
  finalVideoStatuses.includes(status);

export const videoRejectionReasonSchema = z.enum([
  "NOT_A_VIDEO",
  "UNSUPPORTED_CONTAINER",
  "UNSUPPORTED_CODEC",
  "TOO_LARGE",
  "NO_DURATION",
]);

export type VideoRejectionReason = z.infer<typeof videoRejectionReasonSchema>;

export const videoFailureReasonSchema = z.enum([
  "SOURCE_UNREADABLE",
  "ENCODE_FAILED",
  "TIMED_OUT",
  "VALIDATION_FAILED",
  "PUBLISH_FAILED",
]);

export type VideoFailureReason = z.infer<typeof videoFailureReasonSchema>;

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

export const captionLanguages = ["en"] as const;

export const captionLanguageSchema = z.enum(captionLanguages);

export type CaptionLanguage = z.infer<typeof captionLanguageSchema>;

export const videoSlotSummarySchema = z.object({
  id: z.uuid(),
  order: z.number().int().min(1),
  title: z.string(),
  required: z.boolean(),
  status: videoSlotStatusSchema,
  assetKey: z.string().max(128).nullable(),
  rejectionReason: videoRejectionReasonSchema.nullable(),
  failureReason: videoFailureReasonSchema.nullable(),
  uploadedAt: z.iso.datetime().nullable(),
  statusChangedAt: z.iso.datetime().nullable(),
  captions: z.array(captionLanguageSchema),
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

export const videoCaptionParamsSchema = videoSlotParamsSchema.extend({
  language: captionLanguageSchema,
});

const gibibyte = 1024 ** 3;

export const videoUploadLimits = {
  maxBytes: 2 * gibibyte,
  minBytes: 12,
  extensions: ["mp4", "mov", "webm", "mkv"],
  containers: ["mov", "mp4", "matroska", "webm"],
  videoCodecs: ["h264", "hevc", "vp8", "vp9", "av1"],
} as const;

export const tusProtocol = {
  version: "1.0.0",
  offsetContentType: "application/offset+octet-stream",
} as const;

export const videoUploadedEventType = "video.uploaded";

export const videoQueuedEventType = "video.queued";

export const videoUploadedPayloadSchema = z.object({ assetId: z.uuid() });

export type VideoUploadedPayload = z.infer<typeof videoUploadedPayloadSchema>;

export const assetKeySchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);

export const videoUploadParamsSchema = videoSlotParamsSchema.extend({
  assetKey: assetKeySchema,
});

export const videoLibrarySortFields = [
  "title",
  "-title",
  "statusChangedAt",
  "-statusChangedAt",
] as const;

export const videoLibraryStatusSchema = videoSlotStatusSchema.exclude(["NOT_UPLOADED"]);

export type VideoLibraryStatus = z.infer<typeof videoLibraryStatusSchema>;

export const videoLibraryListQuerySchema = z.object({
  status: videoLibraryStatusSchema.optional(),
  courseId: z.uuid().optional(),
  sort: z.enum(videoLibrarySortFields).default("-statusChangedAt"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .refine((value) => (adminPageSizes as readonly number[]).includes(value), "Invalid page size")
    .default(25),
});

export type VideoLibraryListQuery = z.infer<typeof videoLibraryListQuerySchema>;

export const videoLibraryItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: videoLibraryStatusSchema,
  rejectionReason: videoRejectionReasonSchema.nullable(),
  failureReason: videoFailureReasonSchema.nullable(),
  uploadedAt: z.iso.datetime(),
  statusChangedAt: z.iso.datetime(),
  course: z.object({ id: z.uuid(), title: z.string() }),
  module: z.object({ id: z.uuid(), title: z.string() }),
});

export type VideoLibraryItem = z.infer<typeof videoLibraryItemSchema>;

export const videoLibraryListResponseSchema = z.object({
  items: z.array(videoLibraryItemSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});

export type VideoLibraryListResponse = z.infer<typeof videoLibraryListResponseSchema>;
