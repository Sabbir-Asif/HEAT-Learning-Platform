import type { HeatClient } from "@heat/db";
import type { MediaCleanupStore, UnlinkedAsset } from "./media-cleanup";

export class PrismaMediaCleanupStore implements MediaCleanupStore {
  constructor(private readonly database: HeatClient) {}

  findUnlinked(createdBefore: Date, limit: number): Promise<UnlinkedAsset[]> {
    return this.database.mediaAsset.findMany({
      where: {
        linkedEntity: null,
        createdAt: { lt: createdBefore },
        courses: { none: {} },
        resources: { none: {} },
      },
      select: { id: true, key: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async remove(id: string): Promise<void> {
    await this.database.mediaAsset.delete({ where: { id } });
  }
}
