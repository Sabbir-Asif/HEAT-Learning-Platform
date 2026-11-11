import { describe, expect, test, vi } from "vitest";
import {
  FfprobeCodecProbe,
  FfprobeSourceProbe,
  codecArguments,
  parseCodecNames,
  parseFrameRate,
  parseSourceInfo,
} from "../../src/transcode/media-probe";

const source = (overrides: object = {}, streams: object[] | undefined = undefined) =>
  JSON.stringify({
    streams: streams ?? [
      { codec_type: "video", width: 1920, height: 1080, r_frame_rate: "30000/1001" },
      { codec_type: "audio" },
    ],
    format: { duration: "62.5" },
    ...overrides,
  });

describe("parseFrameRate", () => {
  test("divides a fraction and rejects zero or garbage", () => {
    expect(parseFrameRate("30000/1001")).toBeCloseTo(29.97, 2);
    expect(parseFrameRate("25")).toBe(25);
    expect(parseFrameRate("0/0")).toBeNull();
    expect(parseFrameRate("abc")).toBeNull();
    expect(parseFrameRate(undefined)).toBeNull();
  });
});

describe("parseSourceInfo", () => {
  test("reads size, duration, audio and the frame rate", () => {
    expect(parseSourceInfo(source())).toMatchObject({
      width: 1920,
      height: 1080,
      durationSeconds: 62.5,
      hasAudio: true,
    });
  });

  test("caps the frame rate at 30", () => {
    const fast = source({}, [
      { codec_type: "video", width: 1280, height: 720, r_frame_rate: "60/1" },
    ]);
    expect(parseSourceInfo(fast)).toMatchObject({ fps: 30, hasAudio: false });
  });

  test("falls back to the average rate, then to 30", () => {
    const average = source({}, [
      { codec_type: "video", width: 640, height: 360, r_frame_rate: "0/0", avg_frame_rate: "24/1" },
    ]);
    expect(parseSourceInfo(average)?.fps).toBe(24);
    const none = source({}, [{ codec_type: "video", width: 640, height: 360 }]);
    expect(parseSourceInfo(none)?.fps).toBe(30);
  });

  test("returns null without a sized video stream or a positive duration", () => {
    expect(parseSourceInfo("nope")).toBeNull();
    expect(parseSourceInfo(JSON.stringify({ streams: [] }))).toBeNull();
    expect(parseSourceInfo(source({}, [{ codec_type: "audio" }]))).toBeNull();
    expect(parseSourceInfo(source({ format: {} }))).toBeNull();
    expect(parseSourceInfo(source({ format: { duration: "0" } }))).toBeNull();
  });
});

describe("FfprobeSourceProbe", () => {
  test("runs ffprobe without a shell and parses its output", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: source() });
    expect(await new FfprobeSourceProbe(run).probe("/in.orig")).toMatchObject({ height: 1080 });
    expect(run.mock.calls[0]?.[0]).toBe("ffprobe");
    expect(run.mock.calls[0]?.[2]).toMatchObject({
      shell: false,
      env: { PATH: process.env.PATH ?? "" },
    });
  });

  test("gives the codec probe only PATH in its environment", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: "h264\n" });
    await new FfprobeCodecProbe(run).codecs("/p");
    expect(run.mock.calls[0]?.[2]).toMatchObject({ env: { PATH: process.env.PATH ?? "" } });
  });

  test("treats an error exit as unreadable and rethrows other failures", async () => {
    const bad = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: 1 }));
    expect(await new FfprobeSourceProbe(bad).probe("/x")).toBeNull();
    const missing = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("spawn"), { code: "ENOENT" }));
    await expect(new FfprobeSourceProbe(missing).probe("/x")).rejects.toThrow("spawn");
  });
});

describe("codec probing", () => {
  test("restricts the protocol to files and puts the input last", () => {
    const args = codecArguments("/out/360p/index.m3u8");
    expect(args[args.indexOf("-protocol_whitelist") + 1]).toBe("file");
    expect(args.slice(-2)).toEqual(["-i", "/out/360p/index.m3u8"]);
  });

  test("parses one codec per line", () => {
    expect(parseCodecNames("h264\naac\n\n")).toEqual(["h264", "aac"]);
  });

  test("returns codecs, null on an error exit, and rethrows other failures", async () => {
    const ok = vi.fn().mockResolvedValue({ stdout: "h264\naac\n" });
    expect(await new FfprobeCodecProbe(ok).codecs("/p")).toEqual(["h264", "aac"]);
    const bad = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { code: 1 }));
    expect(await new FfprobeCodecProbe(bad).codecs("/p")).toBeNull();
    const killed = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("timeout"), { killed: true, code: null }));
    await expect(new FfprobeCodecProbe(killed).codecs("/p")).rejects.toThrow("timeout");
  });
});
