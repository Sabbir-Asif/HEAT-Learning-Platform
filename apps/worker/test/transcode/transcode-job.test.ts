import { describe, expect, test, vi } from "vitest";
import type { FfmpegRunner, EncodeResult } from "../../src/transcode/ffmpeg-runner";
import type { SourceInfo } from "../../src/transcode/media-probe";
import { TranscodeJob } from "../../src/transcode/transcode-job";
import type { TranscodeStore } from "../../src/transcode/transcode-job";
import { FakeFilesystem } from "./fake-filesystem";

const assetId = "0198f1a0-0000-7000-8000-0000000000a1";
const key = "k".repeat(32);
const hls = "/hls";
const output = `${hls}/${key}`;

const source = (overrides: Partial<SourceInfo> = {}): SourceInfo => ({
  width: 1920,
  height: 1080,
  fps: 30,
  durationSeconds: 60,
  hasAudio: true,
  ...overrides,
});

const playlistOf = (seconds: number): string => {
  const full = Math.floor(seconds / 6);
  const rest = seconds - full * 6;
  const durations = [...Array<number>(full).fill(6), ...(rest > 0 ? [rest] : [])];
  return [
    "#EXTM3U",
    ...durations.flatMap((d, i) => [
      `#EXTINF:${d.toFixed(6)},`,
      `segment_${String(i).padStart(5, "0")}.ts`,
    ]),
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
};

interface Options {
  source?: SourceInfo | null;
  probeError?: boolean;
  encode?: (args: readonly string[], filesystem: FakeFilesystem) => EncodeResult;
  codecs?: string[] | null;
  codecsError?: boolean;
  readyError?: boolean;
  claimed?: boolean;
  ready?: boolean;
  times?: number[];
  timeoutPolicy?: { factor: number; minSeconds: number; maxSeconds: number };
}

const writeRendition = (args: readonly string[], filesystem: FakeFilesystem, seconds: number) => {
  const playlistPath = String(args.at(-1));
  filesystem.files.set(playlistPath, playlistOf(seconds));
  const folder = playlistPath.slice(0, playlistPath.lastIndexOf("/"));
  const count = Math.ceil(seconds / 6);
  for (let i = 0; i < count; i += 1) {
    filesystem.files.set(`${folder}/segment_${String(i).padStart(5, "0")}.ts`, "ts");
  }
};

const build = (options: Options = {}) => {
  const filesystem = new FakeFilesystem();
  const store: TranscodeStore = {
    claim: vi.fn().mockResolvedValue(options.claimed === false ? null : { assetKey: key }),
    markReady: vi.fn(() =>
      options.readyError === true
        ? Promise.reject(new Error("db down"))
        : Promise.resolve(options.ready ?? true),
    ),
    markFailed: vi.fn().mockResolvedValue(undefined),
    reportProgress: vi.fn().mockResolvedValue(undefined),
  };
  const times = [...(options.times ?? [])];
  const ffmpeg: FfmpegRunner & { run: ReturnType<typeof vi.fn> } = {
    run: vi.fn((args: readonly string[]) => {
      const result = options.encode?.(args, filesystem);
      if (result === undefined) writeRendition(args, filesystem, 60);
      return Promise.resolve(result ?? "ok");
    }),
  };
  const sourceProbe = {
    probe: vi.fn(() =>
      options.probeError === true
        ? Promise.reject(new Error("spawn ffprobe ENOENT"))
        : Promise.resolve(options.source === undefined ? source() : options.source),
    ),
  };
  const codecs = {
    codecs: vi.fn(() =>
      options.codecsError === true
        ? Promise.reject(Object.assign(new Error("spawn"), { code: "ENOENT" }))
        : Promise.resolve(options.codecs === undefined ? ["h264", "aac"] : options.codecs),
    ),
  };
  let attempt = 0;
  const job = new TranscodeJob(
    {
      store,
      source: sourceProbe,
      codecs,
      ffmpeg,
      filesystem,
      newAttemptId: () => `a${(attempt += 1)}`,
      nowMs: () => times.shift() ?? 0,
    },
    {
      uploadDirectory: "/uploads",
      hlsDirectory: hls,
      timeout: options.timeoutPolicy ?? { factor: 8, minSeconds: 600, maxSeconds: 14400 },
    },
  );
  return { job, store, ffmpeg, filesystem, sourceProbe };
};

describe("TranscodeJob success", () => {
  test("encodes the ladder, publishes the output and marks the asset ready with its renditions", async () => {
    const { job, store, ffmpeg, filesystem } = build();
    expect(await job.run(assetId, false)).toEqual({ status: "ready" });
    expect(ffmpeg.run).toHaveBeenCalledTimes(4);
    expect(filesystem.files.has(`${output}/master.m3u8`)).toBe(true);
    expect(filesystem.files.has(`${output}/1080p/index.m3u8`)).toBe(true);
    expect(store.markReady).toHaveBeenCalledWith(assetId, {
      durationSeconds: 60,
      renditions: [
        { label: "360p", bitrateKbps: 496 },
        { label: "480p", bitrateKbps: 746 },
        { label: "720p", bitrateKbps: 1196 },
        { label: "1080p", bitrateKbps: 2296 },
      ],
    });
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(filesystem.filesUnder(`${hls}/.staging-${key}-a1`)).toEqual([]);
  });

  test("reports progress at the start and after every rendition", async () => {
    const { job, store } = build();
    await job.run(assetId, false);
    expect(vi.mocked(store.reportProgress).mock.calls.map((call) => call[1])).toEqual([
      0, 25, 50, 75, 100,
    ]);
  });

  test("reports progress inside a rendition from FFmpeg's encoded time, only upwards", async () => {
    const { job, store, ffmpeg, filesystem } = build({
      source: source({ width: 640, height: 360 }),
    });
    ffmpeg.run.mockImplementationOnce(async (args: readonly string[], _timeout, onProgress) => {
      writeRendition(args, filesystem, 60);
      onProgress?.(15);
      onProgress?.(15);
      onProgress?.(30);
      return "ok";
    });
    await job.run(assetId, false);
    expect(vi.mocked(store.reportProgress).mock.calls.map((call) => call[1])).toEqual([
      0, 25, 50, 100,
    ]);
  });

  test("a failing progress write does not fail the job", async () => {
    const { job, store } = build();
    vi.mocked(store.reportProgress).mockRejectedValue(new Error("db down"));
    expect(await job.run(assetId, false)).toEqual({ status: "ready" });
  });

  test("encodes one rendition at a time, reading only the upload and writing only the staging directory", async () => {
    const { job, ffmpeg } = build();
    await job.run(assetId, false);
    const calls = ffmpeg.run.mock.calls as Array<[string[], number]>;
    for (const [args] of calls) {
      expect(args[args.indexOf("-i") + 1]).toBe(`/uploads/${key}.orig`);
      expect(args.at(-1)?.startsWith(`${hls}/.staging-${key}-a1/`)).toBe(true);
      expect(args[args.indexOf("-protocol_whitelist") + 1]).toBe("file");
    }
  });

  test("never upscales: a 720p source gets three renditions", async () => {
    const { job, ffmpeg } = build({ source: source({ width: 1280, height: 720 }) });
    await job.run(assetId, false);
    expect(ffmpeg.run).toHaveBeenCalledTimes(3);
  });

  test("a source without audio is encoded and validated as video only", async () => {
    const { job, store } = build({ source: source({ hasAudio: false }), codecs: ["h264"] });
    expect(await job.run(assetId, false)).toEqual({ status: "ready" });
    expect(vi.mocked(store.markReady).mock.calls[0]?.[1].renditions[0]).toEqual({
      label: "360p",
      bitrateKbps: 400,
    });
  });

  test("skips an asset that is not queued", async () => {
    const { job, ffmpeg } = build({ claimed: false });
    expect(await job.run(assetId, false)).toEqual({ status: "skipped" });
    expect(ffmpeg.run).not.toHaveBeenCalled();
  });

  test("reports skipped when the asset changed state before it could be marked ready", async () => {
    const { job } = build({ ready: false });
    expect(await job.run(assetId, false)).toEqual({ status: "skipped" });
  });

  test("a retranscode swaps the new output in and leaves one directory", async () => {
    const { job, filesystem } = build();
    filesystem.files.set(`${output}/master.m3u8`, "old");
    await job.run(assetId, false);
    expect(filesystem.files.get(`${output}/master.m3u8`)).toContain("#EXTM3U");
    expect(filesystem.filesUnder(`${hls}/.previous-${key}-a1`)).toEqual([]);
  });
});

describe("TranscodeJob failures", () => {
  test("an FFmpeg error is retried while attempts remain and leaves the asset processing", async () => {
    const { job, store, filesystem } = build({ encode: () => "failed" });
    expect(await job.run(assetId, false)).toEqual({ status: "retry", reason: "ENCODE_FAILED" });
    expect(store.markFailed).not.toHaveBeenCalled();
    expect(filesystem.filesUnder(output)).toEqual([]);
  });

  test("an FFmpeg error on the final attempt marks the asset failed with a reason", async () => {
    const { job, store, filesystem } = build({ encode: () => "failed" });
    expect(await job.run(assetId, true)).toEqual({ status: "failed", reason: "ENCODE_FAILED" });
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "ENCODE_FAILED");
    expect(filesystem.filesUnder(output)).toEqual([]);
    expect(filesystem.filesUnder(`${hls}/.staging-${key}-a1`)).toEqual([]);
  });

  test("a killed FFmpeg after a partial write leaves no partial output visible", async () => {
    const { job, filesystem } = build({
      encode: (args, fs) => {
        writeRendition(args, fs, 12);
        return "failed";
      },
    });
    await job.run(assetId, true);
    expect(filesystem.filesUnder(output)).toEqual([]);
    expect([...filesystem.files.keys()].filter((path) => path.startsWith(hls))).toEqual([]);
  });

  test("a timeout is final at once and stores TIMED_OUT", async () => {
    const { job, store } = build({ encode: () => "timed-out" });
    expect(await job.run(assetId, false)).toEqual({ status: "failed", reason: "TIMED_OUT" });
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "TIMED_OUT");
  });

  test("the job deadline is shared across renditions and times out when it is used up", async () => {
    const { job, ffmpeg, store } = build({
      times: [0, 100, 1_000_000_000],
      timeoutPolicy: { factor: 1, minSeconds: 1, maxSeconds: 100 },
    });
    expect(await job.run(assetId, false)).toEqual({ status: "failed", reason: "TIMED_OUT" });
    expect(ffmpeg.run).toHaveBeenCalledTimes(1);
    expect(ffmpeg.run.mock.calls[0]?.[1]).toBe(60_000 - 100);
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "TIMED_OUT");
  });

  test("output with a missing segment fails validation and is never published", async () => {
    const { job, store, filesystem } = build({
      encode: (args, fs) => {
        writeRendition(args, fs, 60);
        if (args.at(-1)?.includes("/720p/") === true) {
          fs.files.delete(`${String(args.at(-1)).replace("index.m3u8", "")}segment_00004.ts`);
        }
        return "ok";
      },
    });
    expect(await job.run(assetId, false)).toEqual({
      status: "failed",
      reason: "VALIDATION_FAILED",
    });
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "VALIDATION_FAILED");
    expect(filesystem.filesUnder(output)).toEqual([]);
  });

  test("a rendition with the wrong duration or codecs fails validation", async () => {
    const short = build({
      encode: (args, fs) => {
        writeRendition(args, fs, 30);
        return "ok";
      },
    });
    expect(await short.job.run(assetId, false)).toEqual({
      status: "failed",
      reason: "VALIDATION_FAILED",
    });
    const wrongCodec = build({ codecs: ["hevc", "aac"] });
    expect(await wrongCodec.job.run(assetId, false)).toEqual({
      status: "failed",
      reason: "VALIDATION_FAILED",
    });
  });

  test("an unreadable source fails at once without encoding", async () => {
    const { job, ffmpeg, store } = build({ source: null });
    expect(await job.run(assetId, false)).toEqual({
      status: "failed",
      reason: "SOURCE_UNREADABLE",
    });
    expect(ffmpeg.run).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "SOURCE_UNREADABLE");
  });

  test("a probe that cannot run is retried", async () => {
    const { job } = build({ probeError: true });
    expect(await job.run(assetId, false)).toEqual({
      status: "retry",
      reason: "SOURCE_UNREADABLE",
    });
  });

  test("an unexpected error while encoding is retried as an encode failure", async () => {
    const { job, ffmpeg } = build();
    ffmpeg.run.mockRejectedValueOnce(new Error("boom"));
    expect(await job.run(assetId, false)).toEqual({ status: "retry", reason: "ENCODE_FAILED" });
  });

  test("a failed swap keeps the previous output and is retried as a publish failure", async () => {
    const { job, filesystem } = build();
    filesystem.files.set(`${output}/master.m3u8`, "old");
    const original = filesystem.rename.bind(filesystem);
    let renames = 0;
    filesystem.rename = (from, to) => {
      renames += 1;
      return renames === 2 ? Promise.reject(new Error("disk full")) : original(from, to);
    };
    expect(await job.run(assetId, false)).toEqual({ status: "retry", reason: "PUBLISH_FAILED" });
    expect(filesystem.files.get(`${output}/master.m3u8`)).toBe("old");
  });

  test("a failed retranscode leaves the previous ready output playing", async () => {
    const { job, filesystem } = build({ encode: () => "failed" });
    filesystem.files.set(`${output}/master.m3u8`, "old");
    filesystem.files.set(`${output}/360p/segment_00000.ts`, "old-segment");
    await job.run(assetId, true);
    expect(filesystem.files.get(`${output}/master.m3u8`)).toBe("old");
    expect(filesystem.files.get(`${output}/360p/segment_00000.ts`)).toBe("old-segment");
  });

  test("each attempt uses a new staging directory", async () => {
    const { job, ffmpeg } = build({ encode: () => "failed" });
    await job.run(assetId, false);
    await job.run(assetId, false);
    const calls = ffmpeg.run.mock.calls as Array<[string[]]>;
    const first = calls[0]?.[0].at(-1) ?? "";
    const second = calls[1]?.[0].at(-1) ?? "";
    expect(first).toContain(".staging-");
    expect(first.split("/index.m3u8")[0]).not.toBe(second.split("/index.m3u8")[0]);
  });
});

describe("TranscodeJob unexpected errors", () => {
  test("a codec probe that cannot run is retried while attempts remain", async () => {
    const { job, store } = build({ codecsError: true });
    expect(await job.run(assetId, false)).toEqual({
      status: "retry",
      reason: "VALIDATION_FAILED",
    });
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  test("a codec probe that cannot run ends the asset failed on the final attempt", async () => {
    const { job, store, filesystem } = build({ codecsError: true });
    expect(await job.run(assetId, true)).toEqual({
      status: "failed",
      reason: "VALIDATION_FAILED",
    });
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "VALIDATION_FAILED");
    expect(filesystem.filesUnder(output)).toEqual([]);
  });

  test("a store error on the final attempt still marks the asset failed and rethrows", async () => {
    const { job, store, filesystem } = build({ readyError: true });
    await expect(job.run(assetId, true)).rejects.toThrow("db down");
    expect(store.markFailed).toHaveBeenCalledWith(assetId, "ENCODE_FAILED");
    expect(filesystem.filesUnder(output)).toEqual([]);
  });

  test("a store error before the final attempt rethrows without marking failed", async () => {
    const { job, store } = build({ readyError: true });
    await expect(job.run(assetId, false)).rejects.toThrow("db down");
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  test("a failing markFailed does not hide the original error", async () => {
    const { job, store } = build({ readyError: true });
    vi.mocked(store.markFailed).mockRejectedValueOnce(new Error("also down"));
    await expect(job.run(assetId, true)).rejects.toThrow("db down");
  });

  test("removes the published output when the asset can no longer be marked ready", async () => {
    const { job, filesystem } = build({ ready: false });
    expect(await job.run(assetId, false)).toEqual({ status: "skipped" });
    expect(filesystem.filesUnder(output)).toEqual([]);
  });

  test("puts the previous output back when marking ready is refused", async () => {
    const { job, filesystem } = build({ ready: false });
    filesystem.files.set(`${output}/master.m3u8`, "old");
    await job.run(assetId, false);
    expect(filesystem.files.get(`${output}/master.m3u8`)).toBe("old");
    expect(filesystem.filesUnder(`${hls}/.previous-${key}-a1`)).toEqual([]);
  });

  test("puts the previous output back when marking ready throws", async () => {
    const { job, filesystem } = build({ readyError: true });
    filesystem.files.set(`${output}/master.m3u8`, "old");
    await expect(job.run(assetId, false)).rejects.toThrow("db down");
    expect(filesystem.files.get(`${output}/master.m3u8`)).toBe("old");
  });
});
