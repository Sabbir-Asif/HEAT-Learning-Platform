import type { NewsPublishedPayload } from "@heat/contracts";
import type { HeatClient, Prisma } from "@heat/db";
import type { DueNewsPost, NewsPublicationStore } from "./news-publication";

const announcedFilter = (eventType: string, postId: string): Prisma.OutboxWhereInput => ({
  eventType,
  payload: { path: ["postId"], equals: postId },
});

export class PrismaNewsPublicationStore implements NewsPublicationStore {
  constructor(private readonly database: HeatClient) {}

  findUnannounced(now: Date, since: Date): Promise<DueNewsPost[]> {
    return this.database.newsPost.findMany({
      where: { deletedAt: null, publishedAt: { gt: since, lte: now } },
      orderBy: { publishedAt: "asc" },
      select: { id: true, slug: true, title: true },
    });
  }

  announce(post: DueNewsPost, eventType: string, payload: NewsPublishedPayload): Promise<boolean> {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.outbox.findFirst({
        where: announcedFilter(eventType, post.id),
        select: { id: true },
      });
      if (existing !== null) return false;
      await tx.outbox.create({ data: { eventType, payload } });
      return true;
    });
  }
}
