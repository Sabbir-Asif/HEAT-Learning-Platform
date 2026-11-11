import { videoUploadLimits } from "@heat/contracts";
import { describe, expect, test } from "vitest";
import { parseFfprobeJson, probeOutcome } from "../../src/transcode/probe-outcome";
import type { ProbeResult } from "../../src/transcode/probe-outcome";

const good: ProbeResult = {
  formatName: "mov,mp4,m4a,3gp,3g2,mj2",
  durationSeconds: 61.4,
  sizeBytes: 5_000_000,
  videoCodecs: ["h264"],
};

describe("probeOutcome", () => {
  test("queues a supported video and keeps its duration", () => {
    expect(probeOutcome(good, videoUploadLimits)).toEqual({
      status: "QUEUED",
      durationSeconds: 61,
    });
  });

  test("accepts Matroska and WebM with VP9", () => {
    const webm = { ...good, formatName: "matroska,webm", videoCodecs: ["vp9"] };
    expect(probeOutcome(webm, videoUploadLimits).status).toBe("QUEUED");
  });

  test("rejects a file ffprobe could not read as not a video", () => {
    expect(probeOutcome(null, videoUploadLimits)).toEqual({
      status: "REJECTED",
      reason: "NOT_A_VIDEO",
    });
  });

  test("rejects a file with no video stream as not a video", () => {
    expect(probeOutcome({ ...good, videoCodecs: [] }, videoUploadLimits)).toEqual({
      status: "REJECTED",
      reason: "NOT_A_VIDEO",
    });
  });

  test("rejects an unsupported codec", () => {
    expect(probeOutcome({ ...good, videoCodecs: ["mpeg2video"] }, videoUploadLimits)).toEqual({
      status: "REJECTED",
      reason: "UNSUPPORTED_CODEC",
    });
  });

  test("rejects an unsupported container", () => {
    expect(probeOutcome({ ...good, formatName: "avi" }, videoUploadLimits)).toEqual({
      status: "REJECTED",
      reason: "UNSUPPORTED_CONTAINER",
    });
  });

  test("rejects a file over the size cap", () => {
    expect(
      probeOutcome({ ...good, sizeBytes: videoUploadLimits.maxBytes + 1 }, videoUploadLimits),
    ).toEqual({ status: "REJECTED", reason: "TOO_LARGE" });
  });

  test("rejects a truncated file with no duration or a zero duration", () => {
    for (const durationSeconds of [null, 0, -1]) {
      expect(probeOutcome({ ...good, durationSeconds }, videoUploadLimits)).toEqual({
        status: "REJECTED",
        reason: "NO_DURATION",
      });
    }
  });
});

describe("parseFfprobeJson", () => {
  const output = JSON.stringify({
    streams: [
      { codec_type: "video", codec_name: "h264" },
      { codec_type: "audio", codec_name: "aac" },
    ],
    format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.5", size: "1048576" },
  });

  test("reads format, duration, size and the video codecs", () => {
    expect(parseFfprobeJson(output)).toEqual({
      formatName: "mov,mp4,m4a,3gp,3g2,mj2",
      durationSeconds: 12.5,
      sizeBytes: 1048576,
      videoCodecs: ["h264"],
    });
  });

  test("treats a missing or non numeric duration as none", () => {
    const text = JSON.stringify({
      streams: [{ codec_type: "video", codec_name: "h264" }],
      format: { format_name: "matroska,webm", duration: "N/A", size: "10" },
    });
    expect(parseFfprobeJson(text)?.durationSeconds).toBeNull();
  });

  test("returns null for output that is not an ffprobe document", () => {
    expect(parseFfprobeJson("not json")).toBeNull();
    expect(parseFfprobeJson("{}")).toBeNull();
    expect(parseFfprobeJson(JSON.stringify({ format: { format_name: 3 } }))).toBeNull();
  });
});
