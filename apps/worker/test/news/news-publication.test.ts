import { describe, expect, test } from "vitest";
import {
  NewsPublication,
  announcementWindowMs,
  type DueNewsPost,
  type NewsPublicationStore,
} from "../../src/news/news-publication";

const now = new Date("2026-11-12T06:00:00.000Z");

const post = (id: string): DueNewsPost => ({ id, slug: `post-${id}`, title: `Post ${id}` });

class FakeStore implements NewsPublicationStore {
  due: DueNewsPost[] = [];
  announced = new Set<string>();
  events: Array<{ eventType: string; payload: unknown }> = [];
  failing = new Set<string>();
  window: { now: Date; since: Date } | null = null;

  findUnannounced(at: Date, since: Date): Promise<DueNewsPost[]> {
    this.window = { now: at, since };
    return Promise.resolve(this.due.filter((item) => !this.announced.has(item.id)));
  }

  announce(item: DueNewsPost, eventType: string, payload: unknown): Promise<boolean> {
    if (this.failing.has(item.id)) return Promise.reject(new Error("database down"));
    if (this.announced.has(item.id)) return Promise.resolve(false);
    this.announced.add(item.id);
    this.events.push({ eventType, payload });
    return Promise.resolve(true);
  }
}

const setup = () => {
  const store = new FakeStore();
  const errors: string[] = [];
  const revalidated: string[][] = [];
  const revalidation = {
    failing: false,
    revalidate(tags: string[]): Promise<void> {
      if (this.failing) return Promise.reject(new Error("frontend down"));
      revalidated.push(tags);
      return Promise.resolve();
    },
  };
  const publication = new NewsPublication(
    store,
    { now: () => now },
    { info: () => undefined, error: (line) => errors.push(line) },
    revalidation,
  );
  return { store, publication, errors, revalidated, revalidation };
};

describe("NewsPublication", () => {
  test("writes one news published event per due post", async () => {
    const { store, publication } = setup();
    store.due = [post("a"), post("b")];

    expect(await publication.announceDue()).toBe(2);

    expect(store.events).toEqual([
      { eventType: "news.published", payload: { postId: "a", slug: "post-a", title: "Post a" } },
      { eventType: "news.published", payload: { postId: "b", slug: "post-b", title: "Post b" } },
    ]);
  });

  test("does not announce the same post twice", async () => {
    const { store, publication } = setup();
    store.due = [post("a")];

    await publication.announceDue();
    expect(await publication.announceDue()).toBe(0);

    expect(store.events).toHaveLength(1);
  });

  test("looks back only over the announcement window", async () => {
    const { store, publication } = setup();

    await publication.announceDue();

    expect(store.window).toEqual({
      now,
      since: new Date(now.getTime() - announcementWindowMs),
    });
  });

  test("keeps going after one post fails and reports it", async () => {
    const { store, publication, errors } = setup();
    store.due = [post("a"), post("b")];
    store.failing.add("a");

    expect(await publication.announceDue()).toBe(1);

    expect(store.events).toHaveLength(1);
    expect(errors[0]).toContain("a was not announced");
  });

  test("refreshes the news list and each article once posts go live", async () => {
    const { store, publication, revalidated } = setup();
    store.due = [post("a"), post("b")];

    await publication.announceDue();

    expect(revalidated).toEqual([["news", "news:post-a", "news:post-b"]]);
  });

  test("does not refresh anything when no post went live", async () => {
    const { publication, revalidated } = setup();

    await publication.announceDue();

    expect(revalidated).toEqual([]);
  });

  test("reports a failed refresh without losing the announcement count", async () => {
    const { store, publication, errors, revalidation } = setup();
    store.due = [post("a")];
    revalidation.failing = true;

    expect(await publication.announceDue()).toBe(1);

    expect(errors[0]).toContain("Public pages were not refreshed");
  });
});
