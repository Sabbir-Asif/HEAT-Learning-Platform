import { newsListCacheTag, newsPostCacheTag, newsPublishedEventType } from "@heat/contracts";
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

export interface NewsRevalidation {
  revalidate(tags: string[]): Promise<void>;
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
    private readonly revalidation: NewsRevalidation,
  ) {}

  async announceDue(): Promise<number> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - announcementWindowMs);
    const due = await this.store.findUnannounced(now, since);
    let announced = 0;
    const slugs: string[] = [];
    for (const post of due) {
      try {
        const created = await this.store.announce(post, newsPublishedEventType, {
          postId: post.id,
          slug: post.slug,
          title: post.title,
        });
        if (created) {
          announced += 1;
          slugs.push(post.slug);
        }
      } catch (error) {
        this.logger.error(
          `News ${post.id} was not announced: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    if (announced > 0) {
      this.logger.info(`Announced ${announced} news posts`);
      await this.refreshPublicPages(slugs);
    }
    return announced;
  }

  private async refreshPublicPages(slugs: string[]): Promise<void> {
    try {
      await this.revalidation.revalidate([newsListCacheTag, ...slugs.map(newsPostCacheTag)]);
    } catch (error) {
      this.logger.error(
        `Public pages were not refreshed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}
