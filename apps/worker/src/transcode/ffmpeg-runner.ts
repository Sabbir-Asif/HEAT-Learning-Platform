import { spawn } from "node:child_process";
import type { EventEmitter } from "node:events";
import { ProgressLineReader, progressArgs } from "./ffmpeg-progress";

export type EncodeResult = "ok" | "failed" | "timed-out";

export interface FfmpegRunner {
  run(
    args: readonly string[],
    timeoutMs: number,
    onProgress?: (encodedSeconds: number) => void,
  ): Promise<EncodeResult>;
}

export interface ProgressStream {
  setEncoding(encoding: "utf8"): unknown;
  on(event: "data", listener: (chunk: string) => void): unknown;
}

export interface SpawnedProcess extends EventEmitter {
  stdout?: ProgressStream | null;
  kill(signal: "SIGKILL"): boolean;
}

export interface SpawnOptions {
  stdio: ["ignore", "pipe", "ignore"];
  shell: false;
  env: Record<string, string>;
}

export type SpawnProcess = (file: string, args: string[], options: SpawnOptions) => SpawnedProcess;

const NICE_LEVEL = "19";

export const niceCommand = (args: readonly string[]): { file: string; args: string[] } => ({
  file: "nice",
  args: ["-n", NICE_LEVEL, "ffmpeg", ...args],
});

export const assertLocalOnly = (args: readonly string[]): void => {
  const whitelist = args.indexOf("-protocol_whitelist");
  const input = args.indexOf("-i");
  if (whitelist < 0 || args[whitelist + 1] !== "file" || input < 0 || whitelist > input) {
    throw new Error("FFmpeg must be restricted to the file protocol before its input");
  }
};

const defaultSpawn: SpawnProcess = (file, args, options) => spawn(file, args, options);

export class NodeFfmpegRunner implements FfmpegRunner {
  constructor(
    private readonly start: SpawnProcess = defaultSpawn,
    private readonly path: string = process.env.PATH ?? "",
    private readonly onExit: (code: number | null) => void = () => undefined,
  ) {}

  run(
    args: readonly string[],
    timeoutMs: number,
    onProgress: (encodedSeconds: number) => void = () => undefined,
  ): Promise<EncodeResult> {
    assertLocalOnly(args);
    const command = niceCommand([...progressArgs, ...args]);
    return new Promise((resolve) => {
      const child = this.start(command.file, command.args, {
        stdio: ["ignore", "pipe", "ignore"],
        shell: false,
        env: { PATH: this.path },
      });
      const reader = new ProgressLineReader(onProgress);
      child.stdout?.setEncoding("utf8");
      child.stdout?.on("data", (chunk) => reader.push(chunk));
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);
      const finish = (result: EncodeResult): void => {
        clearTimeout(timer);
        resolve(timedOut ? "timed-out" : result);
      };
      child.once("error", () => finish("failed"));
      child.once("close", (code: number | null) => {
        this.onExit(code);
        finish(code === 0 ? "ok" : "failed");
      });
    });
  }
}
