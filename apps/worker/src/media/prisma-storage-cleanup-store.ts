import type { HeatClient, Prisma } from "@heat/db";
import type { OrphanAsset, StorageCleanupStore } from "./storage-cleanup";

const unreferenced = (): Prisma.VideoAssetWhereInput => ({
  referenceCount: 0,
  videos: { none: {} },
  status: { notIn: ["QUEUED", "PROCESSING"] },
});

export class PrismaStorageCleanupStore implements StorageCleanupStore {
  constructor(private readonly database: HeatClient) {}

  async activeAssetKeys(): Promise<Set<string>> {
    const assets = await this.database.videoAsset.findMany({
      where: { status: "PROCESSING" },
      select: { assetKey: true },
    });
    return new Set(assets.map((asset) => asset.assetKey));
  }

  findOrphans(updatedBefore: Date, afterId: string | null, limit: number): Promise<OrphanAsset[]> {
    return this.database.videoAsset.findMany({
      where: {
        ...unreferenced(),
        updatedAt: { lt: updatedBefore },
        ...(afterId === null ? {} : { id: { gt: afterId } }),
      },
      select: { id: true, assetKey: true },
      orderBy: { id: "asc" },
      take: limit,
    });
  }

  removeOrphan(id: string): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const orphan = await tx.videoAsset.findFirst({
        where: { id, ...unreferenced() },
        select: { id: true },
      });
      if (orphan === null) return false;
      await tx.videoRendition.deleteMany({ where: { assetId: id } });
      await tx.videoCaption.deleteMany({ where: { assetId: id } });
      const removed = await tx.videoAsset.deleteMany({ where: { id, ...unreferenced() } });
      return removed.count > 0;
    });
  }
}
