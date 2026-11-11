import { describe, expect, test } from "vitest";
import {
  keyframesAligned,
  parseMediaPlaylistDurations,
  parseTimes,
  segmentsAboutSixSeconds,
} from "../../src/transcode/ladder-verify";

describe("parseTimes", () => {
  test("reads one number per line and ignores blanks", () => {
    expect(parseTimes("0.000000\n6.000000\n\n12.000000\n")).toEqual([0, 6, 12]);
  });
});

describe("keyframesAligned", () => {
  test("accepts the same keyframes within tolerance", () => {
    expect(keyframesAligned([0, 6, 12], [0, 6.02, 11.98])).toBe(true);
  });

  test("rejects a drifted keyframe", () => {
    expect(keyframesAligned([0, 6, 12], [0, 6.5, 12])).toBe(false);
  });

  test("rejects a different keyframe count", () => {
    expect(keyframesAligned([0, 6], [0, 6, 12])).toBe(false);
  });
});

describe("parseMediaPlaylistDurations", () => {
  test("reads every EXTINF duration", () => {
    const text = "#EXTM3U\n#EXTINF:6.000000,\na.ts\n#EXTINF:6.000000,\nb.ts\n#EXTINF:2.4,\nc.ts\n#EXT-X-ENDLIST\n";
    expect(parseMediaPlaylistDurations(text)).toEqual([6, 6, 2.4]);
  });
});

describe("segmentsAboutSixSeconds", () => {
  test("accepts full segments and a shorter last one", () => {
    expect(segmentsAboutSixSeconds([6, 6.01, 5.99, 2.4])).toBe(true);
  });

  test("rejects a long middle segment", () => {
    expect(segmentsAboutSixSeconds([6, 9, 6])).toBe(false);
  });

  test("rejects a short middle segment", () => {
    expect(segmentsAboutSixSeconds([6, 3, 6])).toBe(false);
  });

  test("rejects a last segment longer than six seconds", () => {
    expect(segmentsAboutSixSeconds([6, 7])).toBe(false);
  });

  test("rejects an empty list", () => {
    expect(segmentsAboutSixSeconds([])).toBe(false);
  });
});
