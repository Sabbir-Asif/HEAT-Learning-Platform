import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NodeFfmpegRunner, assertLocalOnly, niceCommand } from "../../src/transcode/ffmpeg-runner";
import type { SpawnedProcess, SpawnOptions } from "../../src/transcode/ffmpeg-runner";

const safeArgs = ["-protocol_whitelist", "file", "-nostdin", "-i", "/in.orig", "/out/index.m3u8"];

class FakeStdout extends EventEmitter {
  setEncoding = vi.fn();
}

class FakeProcess extends EventEmitter implements SpawnedProcess {
  readonly stdout = new FakeStdout();
  readonly kill = vi.fn(() => {
    queueMicrotask(() => this.emit("close", null));
    return true;
  });
}

const harness = () => {
  const child = new FakeProcess();
  const calls: Array<{ file: string; args: string[]; options: SpawnOptions }> = [];
  const runner = new NodeFfmpegRunner((file, args, options) => {
    calls.push({ file, args, options });
    return child;
  }, "/usr/bin");
  return { child, calls, runner };
};

describe("niceCommand", () => {
  test("runs ffmpeg at the lowest priority with the arguments untouched", () => {
    expect(niceCommand(["-i", "x"])).toEqual({
      file: "nice",
      args: ["-n", "19", "ffmpeg", "-i", "x"],
    });
  });
});

describe("assertLocalOnly", () => {
  test("accepts the file whitelist before the input", () => {
    expect(() => assertLocalOnly(safeArgs)).not.toThrow();
  });

  test("rejects a missing, widened or late whitelist", () => {
    expect(() => assertLocalOnly(["-i", "x"])).toThrow("file protocol");
    expect(() => assertLocalOnly(["-protocol_whitelist", "file,http", "-i", "x"])).toThrow();
    expect(() => assertLocalOnly(["-i", "x", "-protocol_whitelist", "file"])).toThrow();
  });
});

describe("NodeFfmpegRunner", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("starts nice without a shell, with only PATH in the environment and only stdout piped", async () => {
    const { child, calls, runner } = harness();
    const result = runner.run(safeArgs, 1000);
    child.emit("close", 0);
    expect(await result).toBe("ok");
    expect(calls[0]?.file).toBe("nice");
    expect(calls[0]?.args.slice(0, 3)).toEqual(["-n", "19", "ffmpeg"]);
    expect(calls[0]?.args.slice(3, 6)).toEqual(["-progress", "pipe:1", "-nostats"]);
    expect(calls[0]?.options).toEqual({
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
      env: { PATH: "/usr/bin" },
    });
  });

  test("reports the encoded seconds from FFmpeg's progress output, even when lines are split", async () => {
    const { child, runner } = harness();
    const seen: number[] = [];
    const result = runner.run(safeArgs, 1000, (seconds) => seen.push(seconds));
    child.stdout.emit("data", "frame=10\nout_time_us=2500");
    child.stdout.emit("data", "000\nprogress=continue\nout_time_ms=5000000\n");
    child.emit("close", 0);
    await result;
    expect(seen).toEqual([2.5, 5]);
  });

  test("reports a non-zero exit as failed", async () => {
    const { child, runner } = harness();
    const result = runner.run(safeArgs, 1000);
    child.emit("close", 1);
    expect(await result).toBe("failed");
  });

  test("reports the exit code to the observer", async () => {
    const child = new FakeProcess();
    const codes: Array<number | null> = [];
    const runner = new NodeFfmpegRunner(
      () => child,
      "/usr/bin",
      (code) => codes.push(code),
    );
    const result = runner.run(safeArgs, 1000);
    child.emit("close", 137);
    await result;
    expect(codes).toEqual([137]);
  });

  test("reports a spawn error as failed", async () => {
    const { child, runner } = harness();
    const result = runner.run(safeArgs, 1000);
    child.emit("error", new Error("ENOENT"));
    expect(await result).toBe("failed");
  });

  test("kills the process and reports a timeout when it runs too long", async () => {
    const { child, runner } = harness();
    const result = runner.run(safeArgs, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(await result).toBe("timed-out");
  });

  test("does not start FFmpeg without the protocol restriction", () => {
    const { calls, runner } = harness();
    expect(() => runner.run(["-i", "/in.orig"], 1000)).toThrow("file protocol");
    expect(calls).toEqual([]);
  });
});
