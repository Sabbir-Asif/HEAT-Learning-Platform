import type { VideoRejectionReason, videoUploadLimits } from "@heat/contracts";
import { z } from "zod";

export interface ProbeResult {
  formatName: string;
  durationSeconds: number | null;
  sizeBytes: number;
  videoCodecs: string[];
}

export type ProbeOutcome =
  | { status: "QUEUED"; durationSeconds: number }
  | { status: "REJECTED"; reason: VideoRejectionReason };

type ProbeLimits = Pick<typeof videoUploadLimits, "maxBytes" | "containers" | "videoCodecs">;

const rejected = (reason: VideoRejectionReason): ProbeOutcome => ({ status: "REJECTED", reason });

const includes = (list: readonly string[], value: string): boolean => list.includes(value);

export const probeOutcome = (result: ProbeResult | null, limits: ProbeLimits): ProbeOutcome => {
  if (result === null) return rejected("NOT_A_VIDEO");
  if (result.sizeBytes > limits.maxBytes) return rejected("TOO_LARGE");
  if (result.videoCodecs.length === 0) return rejected("NOT_A_VIDEO");
  if (!result.formatName.split(",").some((name) => includes(limits.containers, name))) {
    return rejected("UNSUPPORTED_CONTAINER");
  }
  if (!result.videoCodecs.every((codec) => includes(limits.videoCodecs, codec))) {
    return rejected("UNSUPPORTED_CODEC");
  }
  if (result.durationSeconds === null || result.durationSeconds <= 0) {
    return rejected("NO_DURATION");
  }
  return { status: "QUEUED", durationSeconds: Math.round(result.durationSeconds) };
};

const ffprobeSchema = z.object({
  streams: z
    .array(z.object({ codec_type: z.string(), codec_name: z.string().optional() }))
    .default([]),
  format: z.object({
    format_name: z.string(),
    duration: z.string().optional(),
    size: z.string().optional(),
  }),
});

const numberOrNull = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseFfprobeJson = (text: string): ProbeResult | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = ffprobeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { streams, format } = parsed.data;
  return {
    formatName: format.format_name,
    durationSeconds: numberOrNull(format.duration),
    sizeBytes: numberOrNull(format.size) ?? Number.MAX_SAFE_INTEGER,
    videoCodecs: streams
      .filter((stream) => stream.codec_type === "video")
      .map((stream) => stream.codec_name ?? "unknown"),
  };
};
