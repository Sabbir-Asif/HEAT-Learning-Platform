import type { videoUploadLimits } from "@heat/contracts";
import { join } from "node:path";
import { probeOutcome } from "./probe-outcome";
import type { ProbeOutcome } from "./probe-outcome";
import type { VideoProbe } from "./video-probe";

export interface ProbeStore {
  findUploaded(assetId: string): Promise<{ assetKey: string } | null>;
  apply(assetId: string, outcome: ProbeOutcome): Promise<boolean>;
}

const safeKey = /^[A-Za-z0-9_-]{32}$/;

export class VideoProbeJob {
  constructor(
    private readonly store: ProbeStore,
    private readonly video: VideoProbe,
    private readonly directory: string,
    private readonly limits: typeof videoUploadLimits,
  ) {}

  async run(assetId: string): Promise<"applied" | "skipped"> {
    const asset = await this.store.findUploaded(assetId);
    if (asset === null) return "skipped";
    if (!safeKey.test(asset.assetKey)) throw new Error("Invalid asset key");
    const result = await this.video.probe(join(this.directory, `${asset.assetKey}.orig`));
    const applied = await this.store.apply(assetId, probeOutcome(result, this.limits));
    return applied ? "applied" : "skipped";
  }
}
