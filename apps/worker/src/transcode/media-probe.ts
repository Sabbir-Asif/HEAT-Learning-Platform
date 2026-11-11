import { z } from "zod";
import { exitedWithStatus, ffprobeArguments, nodeExecFile } from "./video-probe";
import type { ExecFile, ExecOptions } from "./video-probe";

export interface SourceInfo {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  hasAudio: boolean;
}

export interface SourceProbe {
  probe(path: string): Promise<SourceInfo | null>;
}

export interface CodecProbe {
  codecs(playlistPath: string): Promise<string[] | null>;
}

export const MAX_FPS = 30;
export const FALLBACK_FPS = 30;

const maxOutputBytes = 1024 * 1024;
const probeTimeoutMs = 60_000;

const sourceSchema = z.object({
  streams: z
    .array(
      z.object({
        codec_type: z.string(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        r_frame_rate: z.string().optional(),
        avg_frame_rate: z.string().optional(),
      }),
    )
    .default([]),
  format: z.object({ duration: z.string().optional() }),
});

export const parseFrameRate = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const [numerator, denominator = "1"] = value.split("/");
  const rate = Number(numerator) / Number(denominator);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};

export const parseSourceInfo = (text: string): SourceInfo | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = sourceSchema.safeParse(raw);
  if (!parsed.success) return null;
  const video = parsed.data.streams.find((stream) => stream.codec_type === "video");
  const duration = Number(parsed.data.format.duration);
  if (
    video?.width === undefined ||
    video.height === undefined ||
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return null;
  }
  const rate = parseFrameRate(video.r_frame_rate) ?? parseFrameRate(video.avg_frame_rate);
  return {
    width: video.width,
    height: video.height,
    fps: Math.min(rate ?? FALLBACK_FPS, MAX_FPS),
    durationSeconds: duration,
    hasAudio: parsed.data.streams.some((stream) => stream.codec_type === "audio"),
  };
};

export const codecArguments = (playlistPath: string): string[] => [
  "-v",
  "error",
  "-protocol_whitelist",
  "file",
  "-show_entries",
  "stream=codec_name",
  "-of",
  "csv=p=0",
  "-i",
  playlistPath,
];

export const parseCodecNames = (text: string): string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

const execOptions = (): ExecOptions => ({
  timeout: probeTimeoutMs,
  maxBuffer: maxOutputBytes,
  shell: false,
  env: { PATH: process.env.PATH ?? "" },
});

export class FfprobeSourceProbe implements SourceProbe {
  constructor(private readonly run: ExecFile = nodeExecFile) {}

  async probe(path: string): Promise<SourceInfo | null> {
    try {
      const { stdout } = await this.run("ffprobe", ffprobeArguments(path), execOptions());
      return parseSourceInfo(stdout);
    } catch (error) {
      if (exitedWithStatus(error)) return null;
      throw error;
    }
  }
}

export class FfprobeCodecProbe implements CodecProbe {
  constructor(private readonly run: ExecFile = nodeExecFile) {}

  async codecs(playlistPath: string): Promise<string[] | null> {
    try {
      const { stdout } = await this.run("ffprobe", codecArguments(playlistPath), execOptions());
      return parseCodecNames(stdout);
    } catch (error) {
      if (exitedWithStatus(error)) return null;
      throw error;
    }
  }
}
