import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NodeFfmpegRunner, assertLocalOnly, niceCommand } from "../../src/transcode/ffmpeg-runner";
import type { SpawnedProcess, SpawnOptions } from "../../src/transcode/ffmpeg-runner";

const safeArgs = ["-protocol_whitelist", "file", "-nostdin", "-i", "/in.orig", "/out/index.m3u8"];

class FakeProcess extends EventEmitter implements SpawnedProcess {
  readonly kill = vi.fn((_signal: "SIGKILL") => {
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

  test("starts nice without a shell, with only PATH in the environment and no stdio", async () => {
    const { child, calls, runner } = harness();
    const result = runner.run(safeArgs, 1000);
    child.emit("close", 0);
    expect(await result).toBe("ok");
    expect(calls[0]?.file).toBe("nice");
    expect(calls[0]?.args.slice(0, 3)).toEqual(["-n", "19", "ffmpeg"]);
    expect(calls[0]?.options).toEqual({ stdio: "ignore", shell: false, env: { PATH: "/usr/bin" } });
  });

  test("reports a non-zero exit as failed", async () => {
    const { child, runner } = harness();
    const result = runner.run(safeArgs, 1000);
    child.emit("close", 1);
    expect(await result).toBe("failed");
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
