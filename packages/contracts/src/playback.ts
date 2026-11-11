import { z } from "zod";

export const hlsCookie = { name: "hls_sig", ttlSeconds: 600 } as const;

export const playbackVideoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const playbackSessionResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
});

export type PlaybackSessionResponse = z.infer<typeof playbackSessionResponseSchema>;

export const hlsCookiePath = (videoId: string): string => `/hls/${videoId}/`;
