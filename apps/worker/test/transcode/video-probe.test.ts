import { describe, expect, test, vi } from "vitest";
import { FfprobeVideoProbe, ffprobeArguments } from "../../src/transcode/video-probe";

const document = JSON.stringify({
  streams: [{ codec_type: "video", codec_name: "h264" }],
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "3.0", size: "100" },
});

describe("ffprobeArguments", () => {
  test("limits the protocol to local files and puts the input after the options", () => {
    const args = ffprobeArguments("/srv/uploads/key.orig");
    expect(
      args.slice(args.indexOf("-protocol_whitelist"), args.indexOf("-protocol_whitelist") + 2),
    ).toEqual(["-protocol_whitelist", "file"]);
    expect(args.indexOf("-protocol_whitelist")).toBeLessThan(args.indexOf("-i"));
    expect(args.slice(-2)).toEqual(["-i", "/srv/uploads/key.orig"]);
    expect(args).toContain("json");
  });
});

describe("FfprobeVideoProbe", () => {
  test("runs ffprobe with an argument array, no shell and a timeout, then parses the output", async () => {
    const run = vi.fn().mockResolvedValue({ stdout: document });
    const probe = new FfprobeVideoProbe(run, 5000);
    expect(await probe.probe("/srv/uploads/key.orig")).toMatchObject({ videoCodecs: ["h264"] });
    expect(run).toHaveBeenCalledWith("ffprobe", ffprobeArguments("/srv/uploads/key.orig"), {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
      shell: false,
    });
  });

  test("treats an ffprobe exit with an error status as an unreadable file", async () => {
    const run = vi.fn().mockRejectedValue(Object.assign(new Error("invalid data"), { code: 1 }));
    expect(await new FfprobeVideoProbe(run, 5000).probe("/x")).toBeNull();
  });

  test("lets a missing binary or a timeout fail the job so it is retried", async () => {
    const missing = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("spawn"), { code: "ENOENT" }));
    await expect(new FfprobeVideoProbe(missing, 5000).probe("/x")).rejects.toThrow("spawn");
    const timedOut = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error("timeout"), { killed: true, code: null }));
    await expect(new FfprobeVideoProbe(timedOut, 5000).probe("/x")).rejects.toThrow("timeout");
  });
});
