import { videoUploadLimits } from "@heat/contracts";
import { describe, expect, test, vi } from "vitest";
import type { ProbeOutcome, ProbeResult } from "../../src/transcode/probe-outcome";
import { VideoProbeJob } from "../../src/transcode/video-probe-job";
import type { ProbeStore } from "../../src/transcode/video-probe-job";

const assetId = "0194f3a0-0000-7000-8000-000000000009";
const assetKey = "k".repeat(32);

const good: ProbeResult = {
  formatName: "mov,mp4,m4a,3gp,3g2,mj2",
  durationSeconds: 30,
  sizeBytes: 1000,
  videoCodecs: ["h264"],
};

const setup = (
  options: { found?: boolean; applied?: boolean; result?: ProbeResult | null } = {},
) => {
  const applied: ProbeOutcome[] = [];
  const store: ProbeStore = {
    findUploaded: vi.fn().mockResolvedValue(options.found === false ? null : { assetKey }),
    apply: vi.fn().mockImplementation((_id: string, outcome: ProbeOutcome) => {
      applied.push(outcome);
      return Promise.resolve(options.applied ?? true);
    }),
  };
  const probe = {
    probe: vi.fn().mockResolvedValue(options.result === undefined ? good : options.result),
  };
  const job = new VideoProbeJob(store, probe, "/srv/uploads", videoUploadLimits);
  return { job, store, probe, applied };
};

describe("VideoProbeJob", () => {
  test("probes the stored original by its asset key and queues a supported video", async () => {
    const { job, probe, applied } = setup();
    expect(await job.run(assetId)).toBe("applied");
    expect(probe.probe).toHaveBeenCalledWith(`/srv/uploads/${assetKey}.orig`);
    expect(applied).toEqual([{ status: "QUEUED", durationSeconds: 30 }]);
  });

  test("rejects an unsupported codec with its reason", async () => {
    const { job, applied } = setup({ result: { ...good, videoCodecs: ["mpeg2video"] } });
    await job.run(assetId);
    expect(applied).toEqual([{ status: "REJECTED", reason: "UNSUPPORTED_CODEC" }]);
  });

  test("rejects an unreadable file as not a video", async () => {
    const { job, applied } = setup({ result: null });
    await job.run(assetId);
    expect(applied).toEqual([{ status: "REJECTED", reason: "NOT_A_VIDEO" }]);
  });

  test("skips an asset that is no longer waiting for a probe so a retry is harmless", async () => {
    const { job, probe, store } = setup({ found: false });
    expect(await job.run(assetId)).toBe("skipped");
    expect(probe.probe).not.toHaveBeenCalled();
    expect(store.apply).not.toHaveBeenCalled();
  });

  test("reports skipped when another worker applied the outcome first", async () => {
    const { job } = setup({ applied: false });
    expect(await job.run(assetId)).toBe("skipped");
  });

  test("refuses an asset key that could leave the upload directory", async () => {
    const { job, store } = setup();
    vi.mocked(store.findUploaded).mockResolvedValue({ assetKey: "../../etc/passwd" });
    await expect(job.run(assetId)).rejects.toThrow("Invalid asset key");
  });
});
