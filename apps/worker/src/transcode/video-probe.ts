import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseFfprobeJson } from "./probe-outcome";
import type { ProbeResult } from "./probe-outcome";

export interface VideoProbe {
  probe(path: string): Promise<ProbeResult | null>;
}

export interface ExecOptions {
  timeout: number;
  maxBuffer: number;
  shell: false;
}

export type ExecFile = (
  file: string,
  args: string[],
  options: ExecOptions,
) => Promise<{ stdout: string }>;

const maxOutputBytes = 1024 * 1024;

export const defaultProbeTimeoutMs = 30_000;

export const ffprobeArguments = (path: string): string[] => [
  "-v",
  "error",
  "-protocol_whitelist",
  "file",
  "-print_format",
  "json",
  "-show_format",
  "-show_streams",
  "-i",
  path,
];

export const nodeExecFile: ExecFile = (file, args, options) =>
  promisify(execFile)(file, args, { ...options, encoding: "utf8" });

const exitedWithStatus = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  typeof error.code === "number" &&
  !("killed" in error && error.killed === true);

export class FfprobeVideoProbe implements VideoProbe {
  constructor(
    private readonly run: ExecFile = nodeExecFile,
    private readonly timeoutMs: number = defaultProbeTimeoutMs,
  ) {}

  async probe(path: string): Promise<ProbeResult | null> {
    try {
      const { stdout } = await this.run("ffprobe", ffprobeArguments(path), {
        timeout: this.timeoutMs,
        maxBuffer: maxOutputBytes,
        shell: false,
      });
      return parseFfprobeJson(stdout);
    } catch (error) {
      if (exitedWithStatus(error)) return null;
      throw error;
    }
  }
}
