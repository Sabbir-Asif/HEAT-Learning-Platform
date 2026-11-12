import { videoQueuedEventType } from "@heat/contracts";
import type { HeatClient } from "@heat/db";
import type { ProbeOutcome } from "./probe-outcome";
import type { ProbeStore } from "./video-probe-job";

export class PrismaProbeStore implements ProbeStore {
  constructor(private readonly database: HeatClient) {}

  findUploaded(assetId: string): Promise<{ assetKey: string } | null> {
    return this.database.videoAsset.findFirst({
      where: { id: assetId, status: "UPLOADED" },
      select: { assetKey: true },
    });
  }

  apply(assetId: string, outcome: ProbeOutcome): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const flipped = await tx.videoAsset.updateMany({
        where: { id: assetId, status: "UPLOADED" },
        data:
          outcome.status === "QUEUED"
            ? { status: "QUEUED", durationSeconds: outcome.durationSeconds, rejectionReason: null }
            : { status: "REJECTED", rejectionReason: outcome.reason },
      });
      if (flipped.count === 0) return false;
      if (outcome.status === "QUEUED") {
        await tx.outbox.create({
          data: { eventType: videoQueuedEventType, payload: { assetId } },
        });
      }
      return true;
    });
  }
}
