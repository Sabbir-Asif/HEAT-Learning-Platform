import { describe, expect, test } from "vitest";
import {
  MediaCleanup,
  dhakaDay,
  isCleanupDue,
  unlinkedRetentionHours,
} from "../../src/media/media-cleanup";
import type {
  MediaCleanupStorage,
  MediaCleanupStore,
  UnlinkedAsset,
} from "../../src/media/media-cleanup";

const now = new Date("2026-11-12T10:00:00.000Z");

class FakeStore implements MediaCleanupStore {
  cutoffs: Date[] = [];
  removed: string[] = [];

  constructor(private assets: UnlinkedAsset[]) {}

  async findUnlinked(createdBefore: Date): Promise<UnlinkedAsset[]> {
    this.cutoffs.push(createdBefore);
    return this.assets.filter((asset) => !this.removed.includes(asset.id));
  }

  async remove(id: string): Promise<void> {
    this.removed.push(id);
  }
}

class FakeStorage implements MediaCleanupStorage {
  removedKeys: string[] = [];
  failing = new Set<string>();

  async removeAsset(key: string): Promise<void> {
    if (this.failing.has(key)) throw new Error("disk");
    this.removedKeys.push(key);
  }
}

const log = { info: () => undefined, error: () => undefined };

describe("MediaCleanup", () => {
  test("queries uploads older than the retention window and deletes rows and files", async () => {
    const store = new FakeStore([
      { id: "a", key: "public/2026/11/a" },
      { id: "b", key: "private/2026/11/b" },
    ]);
    const storage = new FakeStorage();

    const removed = await new MediaCleanup(store, storage, () => now, log).run();

    expect(removed).toBe(2);
    expect(store.removed).toEqual(["a", "b"]);
    expect(storage.removedKeys).toEqual(["public/2026/11/a", "private/2026/11/b"]);
    expect(store.cutoffs[0]?.getTime()).toBe(now.getTime() - unlinkedRetentionHours * 3_600_000);
  });

  test("keeps the row when its files could not be removed", async () => {
    const store = new FakeStore([{ id: "a", key: "public/2026/11/a" }]);
    const storage = new FakeStorage();
    storage.failing.add("public/2026/11/a");

    const removed = await new MediaCleanup(store, storage, () => now, log).run();

    expect(removed).toBe(0);
    expect(store.removed).toEqual([]);
  });
});

describe("cleanup schedule", () => {
  test("runs once per Dhaka day from 03:00", () => {
    const beforeRun = new Date("2026-11-11T20:30:00.000Z");
    const afterRun = new Date("2026-11-11T21:00:00.000Z");
    expect(isCleanupDue(beforeRun, null)).toBe(false);
    expect(isCleanupDue(afterRun, null)).toBe(true);
    expect(isCleanupDue(afterRun, dhakaDay(afterRun))).toBe(false);
    expect(dhakaDay(afterRun)).toBe("2026-11-12");
  });
});
