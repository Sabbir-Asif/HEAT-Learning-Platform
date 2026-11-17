import { describe, expect, test } from "vitest";
import { LADDER } from "../../../apps/worker/src/transcode/ladder";
import {
  PROFILES,
  RENDITION_KBPS,
  RENDITION_MIX,
  TARGET_AVERAGE_KBPS,
  averageKbps,
  monthlyEgressTerabytes,
  pacingDelaySeconds,
  peakEgressMbps,
  pickRendition,
  profileStages,
  refreshDue,
  resolveUri,
  segmentEntries,
  variantName,
  variantUris,
} from "../../../tests/load/lib/plan.js";
import {
  csvRow,
  diskLatencyMilliseconds,
  egressMbps,
  parseCpuTimes,
  parseDiskCounters,
  parseTransmitBytes,
  stealPercent,
} from "../../../tests/load/lib/host-metrics.mjs";

describe("rendition mix", () => {
  test("rendition bitrates match the worker ladder including audio", () => {
    for (const rung of LADDER) {
      expect(RENDITION_KBPS[rung.name]).toBe(rung.videoKbps + rung.audioKbps);
    }
  });

  test("the mix averages within 5 percent of 1.2 Mbps", () => {
    const average = averageKbps(RENDITION_MIX);
    expect(Math.abs(average - TARGET_AVERAGE_KBPS) / TARGET_AVERAGE_KBPS).toBeLessThan(0.05);
  });

  test("weights are normalised, so scaling them changes nothing", () => {
    const doubled = RENDITION_MIX.map((entry) => ({ ...entry, weight: entry.weight * 2 }));
    expect(averageKbps(doubled)).toBeCloseTo(averageKbps(RENDITION_MIX));
  });

  test("an empty mix is rejected", () => {
    expect(() => averageKbps([{ name: "360p", weight: 0 }])).toThrow();
  });

  test("pickRendition walks the cumulative weights", () => {
    expect(pickRendition(RENDITION_MIX, 0)).toBe("360p");
    expect(pickRendition(RENDITION_MIX, 0.04)).toBe("360p");
    expect(pickRendition(RENDITION_MIX, 0.05)).toBe("480p");
    expect(pickRendition(RENDITION_MIX, 0.29)).toBe("480p");
    expect(pickRendition(RENDITION_MIX, 0.3)).toBe("720p");
    expect(pickRendition(RENDITION_MIX, 0.84)).toBe("720p");
    expect(pickRendition(RENDITION_MIX, 0.85)).toBe("1080p");
    expect(pickRendition(RENDITION_MIX, 0.999)).toBe("1080p");
  });

  test("pickRendition rejects a roll outside zero to one", () => {
    expect(() => pickRendition(RENDITION_MIX, 1)).toThrow();
    expect(() => pickRendition(RENDITION_MIX, -0.1)).toThrow();
  });
});

describe("profiles and pacing", () => {
  test("the named profiles are 10, 200 and 250 viewers", () => {
    expect(PROFILES.smoke.viewers).toBe(10);
    expect(PROFILES.steady.viewers).toBe(200);
    expect(PROFILES.headroom.viewers).toBe(250);
  });

  test("the smoke profile holds for two minutes in total up to ramp down", () => {
    const { rampSeconds, holdSeconds } = PROFILES.smoke;
    expect(rampSeconds + holdSeconds).toBe(120);
  });

  test("the steady profile holds 200 viewers for 30 minutes", () => {
    expect(PROFILES.steady.holdSeconds).toBe(1800);
    expect(profileStages(PROFILES.steady)).toEqual([
      { duration: "300s", target: 200 },
      { duration: "1800s", target: 200 },
      { duration: "60s", target: 0 },
    ]);
  });

  test("pacing sleeps the rest of the segment and never goes negative", () => {
    expect(pacingDelaySeconds(6, 0.25)).toBeCloseTo(5.75);
    expect(pacingDelaySeconds(6, 9)).toBe(0);
  });

  test("the cookie is refreshed before the 10 minute expiry", () => {
    expect(refreshDue(1000 + 509, 1000)).toBe(false);
    expect(refreshDue(1000 + 510, 1000)).toBe(true);
  });
});

describe("egress arithmetic", () => {
  test("200 viewers at 1.2 Mbps peak at 240 Mbps", () => {
    expect(peakEgressMbps(200, 1200)).toBe(240);
  });

  test("monthly volume follows from average rate and hours", () => {
    expect(monthlyEgressTerabytes(240, 1, 30)).toBeCloseTo(3.24, 2);
    expect(monthlyEgressTerabytes(240, 2, 30)).toBeCloseTo(6.48, 2);
  });
});

describe("playlist parsing", () => {
  const master = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    '#EXT-X-STREAM-INF:BANDWIDTH=496000,RESOLUTION=640x360,CODECS="a,b"',
    "360p/index.m3u8",
    '#EXT-X-STREAM-INF:BANDWIDTH=1196000,RESOLUTION=1280x720,CODECS="a,b"',
    "720p/index.m3u8",
    "",
  ].join("\n");

  test("variant uris come from the lines after each stream entry", () => {
    expect(variantUris(master)).toEqual(["360p/index.m3u8", "720p/index.m3u8"]);
    expect(variantName("720p/index.m3u8")).toBe("720p");
  });

  test("segments carry their own duration, defaulting to six seconds", () => {
    const playlist = [
      "#EXTM3U",
      "#EXTINF:6.000000,",
      "segment_00000.ts",
      "#EXTINF:3.5,",
      "segment_00001.ts",
      "segment_00002.ts",
      "#EXT-X-ENDLIST",
    ].join("\n");
    expect(segmentEntries(playlist)).toEqual([
      { uri: "segment_00000.ts", seconds: 6 },
      { uri: "segment_00001.ts", seconds: 3.5 },
      { uri: "segment_00002.ts", seconds: 3.5 },
    ]);
  });

  test("relative, rooted and absolute uris resolve against the playlist url", () => {
    const base = "https://lms.example.test/hls/abc/master.m3u8";
    expect(resolveUri(base, "720p/index.m3u8")).toBe(
      "https://lms.example.test/hls/abc/720p/index.m3u8",
    );
    expect(resolveUri(base, "/hls/abc/x.ts")).toBe("https://lms.example.test/hls/abc/x.ts");
    expect(resolveUri(base, "https://other.test/x.ts")).toBe("https://other.test/x.ts");
  });
});

describe("host metrics", () => {
  test("steal percent is the steal share of elapsed cpu time", () => {
    const before = parseCpuTimes("cpu  100 0 100 700 0 0 0 0 0 0\n");
    const after = parseCpuTimes("cpu  150 0 150 800 0 0 0 50 0 0\n");
    expect(stealPercent(before, after)).toBeCloseTo(20, 5);
  });

  test("steal percent is zero when no time passed", () => {
    const sample = parseCpuTimes("cpu  1 0 1 1 0 0 0 0\n");
    expect(stealPercent(sample, sample)).toBe(0);
  });

  test("egress reads the transmit column of the named interface", () => {
    const text = [
      "Inter-|   Receive | Transmit",
      " face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs drop fifo colls carrier compressed",
      "    lo: 10 1 0 0 0 0 0 0 20 1 0 0 0 0 0 0",
      "  eth0: 1000 5 0 0 0 0 0 0 7500000 9 0 0 0 0 0 0",
    ].join("\n");
    expect(parseTransmitBytes(text, "eth0")).toBe(7500000);
    expect(() => parseTransmitBytes(text, "eth9")).toThrow();
  });

  test("egress in Mbps over an interval", () => {
    expect(egressMbps(0, 7_500_000, 60)).toBeCloseTo(1, 5);
    expect(egressMbps(100, 50, 60)).toBe(0);
  });

  test("disk latency is busy milliseconds per completed operation", () => {
    const line = (reads, readMs, writes, writeMs) =>
      `   8 0 sda ${reads} 0 0 ${readMs} ${writes} 0 0 ${writeMs} 0 0 0`;
    const before = parseDiskCounters(line(100, 200, 50, 300), "sda");
    const after = parseDiskCounters(line(200, 400, 150, 700), "sda");
    expect(diskLatencyMilliseconds(before, after)).toBeCloseTo(3, 5);
    expect(diskLatencyMilliseconds(after, after)).toBe(0);
    expect(() => parseDiskCounters(line(1, 1, 1, 1), "vda")).toThrow();
  });

  test("a csv row has four fixed-precision columns", () => {
    expect(csvRow("2026-11-17T10:00:00.000Z", 1.234, 240, 2.5)).toBe(
      "2026-11-17T10:00:00.000Z,1.23,240.00,2.50",
    );
  });
});
