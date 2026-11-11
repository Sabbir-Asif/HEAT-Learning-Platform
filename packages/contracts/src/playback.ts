import { z } from "zod";

export const hlsCookie = { name: "hls_sig", ttlSeconds: 600 } as const;

export const playbackVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const playbackCaptionSchema = z.object({
  language: z.string().min(1).max(35),
});

export const playbackSessionResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  manifestPath: z.string(),
  sessionId: z.uuid().nullable(),
  resumePositionSeconds: z.number().int().min(0),
  captions: z.array(playbackCaptionSchema),
});

export const playbackVideoParamsSchema = z.object({ id: z.uuid() });

export const playbackAdminParamsSchema = z.object({ videoId: z.uuid() });

export type PlaybackSessionResponse = z.infer<typeof playbackSessionResponseSchema>;

export const hlsCookiePath = (videoId: string): string => `/hls/${videoId}/`;

export const hlsManifestPath = (assetKey: string): string =>
  `${hlsCookiePath(assetKey)}master.m3u8`;
