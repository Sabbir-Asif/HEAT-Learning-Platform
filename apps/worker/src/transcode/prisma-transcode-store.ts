import type { VideoFailureReason } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import type { ReadyResult, TranscodeStore } from "./transcode-job";

const claimable = ["QUEUED", "PROCESSING"] as const;

export class PrismaTranscodeStore implements TranscodeStore {
  constructor(private readonly database: HeatClient) {}

  async claim(assetId: string): Promise<{ assetKey: string } | null> {
    const asset = await this.database.videoAsset.findFirst({
      where: { id: assetId, status: { in: [...claimable] } },
      select: { assetKey: true },
    });
    if (asset === null) return null;
    const flipped = await this.database.videoAsset.updateMany({
      where: { id: assetId, status: { in: [...claimable] } },
      data: { status: "PROCESSING", failureReason: null },
    });
    return flipped.count === 0 ? null : asset;
  }

  markReady(assetId: string, result: ReadyResult): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const flipped = await tx.videoAsset.updateMany({
        where: { id: assetId, status: "PROCESSING" },
        data: { status: "READY", durationSeconds: result.durationSeconds, failureReason: null },
      });
      if (flipped.count === 0) return false;
      await tx.videoRendition.deleteMany({ where: { assetId } });
      await tx.videoRendition.createMany({
        data: result.renditions.map((rendition) => ({
          assetId,
          label: rendition.label,
          bitrateKbps: rendition.bitrateKbps,
        })),
      });
      return true;
    });
  }

  async markFailed(assetId: string, reason: VideoFailureReason): Promise<void> {
    await this.database.videoAsset.updateMany({
      where: { id: assetId, status: "PROCESSING" },
      data: { status: "FAILED", failureReason: reason },
    });
  }
}
