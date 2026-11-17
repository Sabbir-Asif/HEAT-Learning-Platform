import { newsPublishedEventType } from "@heat/contracts";
import type { NewsPublishedPayload } from "@heat/contracts";

export interface DueNewsPost {
  id: string;
  slug: string;
  title: string;
}

export interface NewsPublicationStore {
  findUnannounced(now: Date, since: Date): Promise<DueNewsPost[]>;
  announce(post: DueNewsPost, eventType: string, payload: NewsPublishedPayload): Promise<boolean>;
}

export interface NewsPublicationLogger {
  info(line: string): void;
  error(line: string): void;
}

export const announcementWindowMs = 7 * 24 * 3600 * 1000;

export class NewsPublication {
  constructor(
    private readonly store: NewsPublicationStore,
    private readonly clock: { now(): Date },
    private readonly logger: NewsPublicationLogger,
  ) {}

  async announceDue(): Promise<number> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - announcementWindowMs);
    const due = await this.store.findUnannounced(now, since);
    let announced = 0;
    for (const post of due) {
      try {
        const created = await this.store.announce(post, newsPublishedEventType, {
          postId: post.id,
          slug: post.slug,
          title: post.title,
        });
        if (created) announced += 1;
      } catch (error) {
        this.logger.error(
          `News ${post.id} was not announced: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    if (announced > 0) this.logger.info(`Announced ${announced} news posts`);
    return announced;
  }
}
