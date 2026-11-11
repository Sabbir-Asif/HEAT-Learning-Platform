import { describe, expect, test } from "vitest";
import { buildMasterPlaylist, selectRenditions } from "../../src/transcode/ladder";
import { durationToleranceSeconds, validateOutput } from "../../src/transcode/output-validation";
import type { OutputSnapshot, RenditionOutput } from "../../src/transcode/output-validation";

const playlistOf = (durations: number[]): string =>
  [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:6",
    ...durations.flatMap((d, i) => [
      `#EXTINF:${d.toFixed(6)},`,
      `segment_${String(i).padStart(5, "0")}.ts`,
    ]),
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");

const sixSecondPlaylist = (seconds: number): string => {
  const full = Math.floor(seconds / 6);
  const rest = seconds - full * 6;
  return playlistOf([...Array<number>(full).fill(6), ...(rest > 0 ? [rest] : [])]);
};

const names = ["360p", "480p"] as const;
const master = buildMasterPlaylist(selectRenditions(480));

const rendition = (name: string, overrides: Partial<RenditionOutput> = {}): RenditionOutput => ({
  name,
  playlist: sixSecondPlaylist(60),
  missingSegments: [],
  codecs: ["h264", "aac"],
  ...overrides,
});

const good = (): OutputSnapshot => ({ master, renditions: names.map((n) => rendition(n)) });

const expectation = { renditionNames: names, sourceDurationSeconds: 60, hasAudio: true };

describe("validateOutput", () => {
  test("accepts a complete output that matches the source", () => {
    expect(validateOutput(expectation, good())).toEqual([]);
  });

  test("fails when the master playlist is missing", () => {
    expect(validateOutput(expectation, { ...good(), master: null })).toContain(
      "master playlist missing",
    );
  });

  test("fails when the master lists other renditions than expected", () => {
    const snapshot = { ...good(), master: buildMasterPlaylist(selectRenditions(360)) };
    expect(validateOutput(expectation, snapshot)).toContain(
      "master playlist does not list the expected renditions",
    );
  });

  test("fails when a rendition has no output at all", () => {
    const snapshot = { ...good(), renditions: [rendition("360p")] };
    expect(validateOutput(expectation, snapshot)).toContain("480p: output missing");
  });

  test("fails when a rendition playlist is missing", () => {
    const snapshot = {
      ...good(),
      renditions: [rendition("360p"), rendition("480p", { playlist: null })],
    };
    expect(validateOutput(expectation, snapshot)).toContain("480p: playlist missing");
  });

  test("fails when a rendition has missing segments", () => {
    const snapshot = {
      ...good(),
      renditions: [rendition("360p"), rendition("480p", { missingSegments: ["segment_00003.ts"] })],
    };
    expect(validateOutput(expectation, snapshot)).toContain("480p: 1 segments missing");
  });

  test("fails when the playlist has no segments", () => {
    const empty = "#EXTM3U\n#EXT-X-ENDLIST\n";
    const snapshot = {
      ...good(),
      renditions: [rendition("360p", { playlist: empty }), rendition("480p")],
    };
    expect(validateOutput(expectation, snapshot)).toContain(
      "360p: playlist has no consistent segment list",
    );
  });

  test("fails when the playlist was never finished", () => {
    const open = sixSecondPlaylist(60).replace("#EXT-X-ENDLIST\n", "");
    const snapshot = {
      ...good(),
      renditions: [rendition("360p", { playlist: open }), rendition("480p")],
    };
    expect(validateOutput(expectation, snapshot)).toContain("360p: playlist is not complete");
  });

  test("fails on a segment name outside the expected pattern", () => {
    const odd = sixSecondPlaylist(60).replace("segment_00001.ts", "../escape.ts");
    const snapshot = {
      ...good(),
      renditions: [rendition("360p", { playlist: odd }), rendition("480p")],
    };
    expect(validateOutput(expectation, snapshot)).toContain("360p: unexpected segment name");
  });

  test("fails when the total duration is outside the tolerance", () => {
    const short = sixSecondPlaylist(36);
    const snapshot = {
      ...good(),
      renditions: [rendition("360p", { playlist: short }), rendition("480p")],
    };
    const problems = validateOutput(expectation, snapshot);
    expect(problems.some((p) => p.startsWith("360p: duration"))).toBe(true);
    expect(problems.some((p) => p.startsWith("360p: 6 segments, expected about 10"))).toBe(true);
  });

  test("accepts a duration within the tolerance", () => {
    const close = sixSecondPlaylist(61.5);
    const snapshot = {
      ...good(),
      renditions: [rendition("360p", { playlist: close }), rendition("480p")],
    };
    expect(validateOutput(expectation, snapshot)).toEqual([]);
  });

  test("fails when segments are not about six seconds", () => {
    const uneven = playlistOf([12, 12, 12, 12, 12]);
    const snapshot = {
      ...good(),
      renditions: [rendition("360p", { playlist: uneven }), rendition("480p")],
    };
    expect(validateOutput(expectation, snapshot)).toContain(
      "360p: segments are not about 6 seconds",
    );
  });

  test("fails on unexpected or unreadable codecs", () => {
    const snapshot = {
      ...good(),
      renditions: [
        rendition("360p", { codecs: ["h264", "mp3"] }),
        rendition("480p", { codecs: null }),
      ],
    };
    const problems = validateOutput(expectation, snapshot);
    expect(problems).toContain("360p: codecs are h264,mp3");
    expect(problems).toContain("480p: codecs are unreadable");
  });

  test("expects video only when the source has no audio", () => {
    const silent = { ...expectation, hasAudio: false };
    const snapshot = {
      ...good(),
      renditions: names.map((n) => rendition(n, { codecs: ["h264"] })),
    };
    expect(validateOutput(silent, snapshot)).toEqual([]);
    expect(validateOutput(expectation, snapshot)).toContain("360p: codecs are h264");
  });
});

describe("durationToleranceSeconds", () => {
  test("is two seconds for short sources and two percent for long ones", () => {
    expect(durationToleranceSeconds(30)).toBe(2);
    expect(durationToleranceSeconds(1000)).toBe(20);
  });
});
