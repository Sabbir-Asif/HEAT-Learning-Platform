import { describe, expect, test } from "vitest";
import {
  LADDER,
  SEGMENT_SECONDS,
  buildMasterPlaylist,
  buildRenditionArgs,
  gopFrames,
  renditionsForSource,
  selectRenditions,
} from "../../src/transcode/ladder";

const names = (sourceHeight: number) => selectRenditions(sourceHeight).map((r) => r.name);

describe("LADDER", () => {
  test("holds the plan bitrates from 360p to 1080p", () => {
    expect(LADDER.map((r) => [r.name, r.height, r.videoKbps])).toEqual([
      ["360p", 360, 400],
      ["480p", 480, 650],
      ["720p", 720, 1100],
      ["1080p", 1080, 2200],
    ]);
  });
});

describe("selectRenditions", () => {
  test("a 1080p source gives four renditions", () => {
    expect(names(1080)).toEqual(["360p", "480p", "720p", "1080p"]);
  });

  test("a 720p source gives three renditions and no 1080p", () => {
    expect(names(720)).toEqual(["360p", "480p", "720p"]);
  });

  test("a source taller than 1080p is capped at 1080p", () => {
    expect(names(2160)).toEqual(["360p", "480p", "720p", "1080p"]);
  });

  test("a source between rungs keeps only the rungs at or below it", () => {
    expect(names(600)).toEqual(["360p", "480p"]);
  });

  test("a source below 360p gives one rendition at its own even height with the lowest bitrate", () => {
    const [only, ...rest] = selectRenditions(241);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ name: "240p", height: 240, videoKbps: 400 });
  });

  test("rejects a height that is not a positive integer", () => {
    expect(() => selectRenditions(0)).toThrow();
    expect(() => selectRenditions(Number.NaN)).toThrow();
  });
});

describe("gopFrames", () => {
  test("is the frame rate times the segment length", () => {
    expect(SEGMENT_SECONDS).toBe(6);
    expect(gopFrames(25)).toBe(150);
    expect(gopFrames(29.97)).toBe(180);
  });
});

describe("buildRenditionArgs", () => {
  const options = { input: "/work/in.mp4", outputDir: "/work/out", fps: 25 };
  const rendition = (name: string) => {
    const found = LADDER.find((r) => r.name === name);
    if (!found) throw new Error(name);
    return found;
  };
  const argsFor = (name: string) => buildRenditionArgs(rendition(name), options);
  const valueAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

  test("returns an argument array with no shell string", () => {
    const args = argsFor("720p");
    expect(Array.isArray(args)).toBe(true);
    expect(args.every((a) => typeof a === "string")).toBe(true);
    expect(valueAfter(args, "-i")).toBe("/work/in.mp4");
  });

  test("encodes H.264 and AAC with the rendition bitrate and height", () => {
    const args = argsFor("720p");
    expect(valueAfter(args, "-c:v")).toBe("libx264");
    expect(valueAfter(args, "-c:a")).toBe("aac");
    expect(valueAfter(args, "-b:v")).toBe("1100k");
    expect(valueAfter(args, "-vf")).toBe("scale=-2:720");
  });

  test("caps the video rate with maxrate and bufsize", () => {
    const args = argsFor("480p");
    expect(valueAfter(args, "-maxrate")).toBe("696k");
    expect(valueAfter(args, "-bufsize")).toBe("1300k");
  });

  test("writes a six second VOD playlist of independent segments under the rendition folder", () => {
    const args = argsFor("360p");
    expect(valueAfter(args, "-hls_time")).toBe("6");
    expect(valueAfter(args, "-hls_playlist_type")).toBe("vod");
    expect(valueAfter(args, "-hls_flags")).toBe("independent_segments");
    expect(valueAfter(args, "-hls_segment_filename")).toBe("/work/out/360p/segment_%05d.ts");
    expect(args[args.length - 1]).toBe("/work/out/360p/index.m3u8");
  });

  test("keyframe and segment parameters are identical across renditions", () => {
    const keyframeFlags = [
      "-g",
      "-keyint_min",
      "-sc_threshold",
      "-force_key_frames",
      "-r",
      "-hls_time",
    ];
    const reference = keyframeFlags.map((f) => valueAfter(argsFor("360p"), f));
    expect(reference).toEqual(["150", "150", "0", "expr:gte(t,n_forced*6)", "25", "6"]);
    for (const { name } of LADDER) {
      expect(keyframeFlags.map((f) => valueAfter(argsFor(name), f))).toEqual(reference);
    }
  });

  test("restricts FFmpeg to the file protocol before the input", () => {
    const args = argsFor("720p");
    expect(args.slice(0, 2)).toEqual(["-protocol_whitelist", "file"]);
    expect(args.indexOf("-protocol_whitelist")).toBeLessThan(args.indexOf("-i"));
  });

  test("rejects an output directory containing a percent sign", () => {
    expect(() =>
      buildRenditionArgs(rendition("360p"), { ...options, outputDir: "/work/100%/out" }),
    ).toThrow();
  });

  test("rejects a frame rate that is not positive", () => {
    expect(() => buildRenditionArgs(rendition("360p"), { ...options, fps: 0 })).toThrow();
  });
});

describe("buildMasterPlaylist", () => {
  test("lists only the renditions it is given, lowest first", () => {
    const text = buildMasterPlaylist(selectRenditions(720));
    expect(text).toContain("360p/index.m3u8");
    expect(text).toContain("480p/index.m3u8");
    expect(text).toContain("720p/index.m3u8");
    expect(text).not.toContain("1080p");
    expect(text.match(/#EXT-X-STREAM-INF/g)).toHaveLength(3);
  });

  test("declares version, independent segments, bandwidth, resolution and codecs", () => {
    const lines = buildMasterPlaylist(selectRenditions(360)).trimEnd().split("\n");
    expect(lines).toEqual([
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-INDEPENDENT-SEGMENTS",
      '#EXT-X-STREAM-INF:BANDWIDTH=496000,RESOLUTION=640x360,CODECS="avc1.640028,mp4a.40.2"',
      "360p/index.m3u8",
    ]);
  });

  test("rejects an empty ladder", () => {
    expect(() => buildMasterPlaylist([])).toThrow();
  });
});

describe("buildMasterPlaylist without audio", () => {
  test("declares only the video codec and bandwidth", () => {
    const text = buildMasterPlaylist(selectRenditions(360), { audio: false });
    expect(text).toContain("BANDWIDTH=400000");
    expect(text).toContain('CODECS="avc1.640028"');
    expect(text).not.toContain("mp4a");
  });

  test("keeps the audio codec and bandwidth by default", () => {
    const text = buildMasterPlaylist(selectRenditions(360));
    expect(text).toContain("BANDWIDTH=496000");
    expect(text).toContain("mp4a.40.2");
  });
});

describe("renditionsForSource", () => {
  test("keeps 16:9 widths for a 16:9 source", () => {
    expect(
      renditionsForSource({ width: 1920, height: 1080 }).map((r) => [r.name, r.width]),
    ).toEqual([
      ["360p", 640],
      ["480p", 854],
      ["720p", 1280],
      ["1080p", 1920],
    ]);
  });

  test("computes an even width from the real aspect ratio", () => {
    expect(
      renditionsForSource({ width: 1280, height: 960 }).map((r) => [r.name, r.width]),
    ).toEqual([
      ["360p", 480],
      ["480p", 640],
      ["720p", 960],
    ]);
  });

  test("never upscales a small source", () => {
    const [only, ...rest] = renditionsForSource({ width: 320, height: 240 });
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ height: 240, width: 320 });
  });

  test("rejects a size that is not positive", () => {
    expect(() => renditionsForSource({ width: 0, height: 720 })).toThrow("positive");
  });
});
