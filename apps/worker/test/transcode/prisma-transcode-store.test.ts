import { describe, expect, test, vi } from "vitest";
import { PrismaTranscodeStore } from "../../src/transcode/prisma-transcode-store";

const assetId = "0194f3a0-0000-7000-8000-000000000009";

const build = (options: { found?: boolean; count?: number } = {}) => {
  const tx = {
    videoAsset: { updateMany: vi.fn().mockResolvedValue({ count: options.count ?? 1 }) },
    videoRendition: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };
  const database = {
    videoAsset: {
      findFirst: vi.fn().mockResolvedValue(options.found === false ? null : { assetKey: "key" }),
      updateMany: vi.fn().mockResolvedValue({ count: options.count ?? 1 }),
    },
    $transaction: vi.fn().mockImplementation((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { store: new PrismaTranscodeStore(database as never), tx, database };
};

describe("PrismaTranscodeStore.claim", () => {
  test("moves a queued or interrupted asset to processing and returns its key", async () => {
    const { store, database } = build();
    expect(await store.claim(assetId)).toEqual({ assetKey: "key" });
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: assetId, status: { in: ["QUEUED", "PROCESSING"] } },
      data: { status: "PROCESSING", failureReason: null },
    });
  });

  test("returns null for an asset in any other state", async () => {
    const { store, database } = build({ found: false });
    expect(await store.claim(assetId)).toBeNull();
    expect(database.videoAsset.updateMany).not.toHaveBeenCalled();
  });

  test("returns null when another change won the race", async () => {
    expect(await build({ count: 0 }).store.claim(assetId)).toBeNull();
  });
});

describe("PrismaTranscodeStore.markReady", () => {
  test("marks ready and replaces the renditions in one transaction", async () => {
    const { store, tx } = build();
    const applied = await store.markReady(assetId, {
      durationSeconds: 61,
      renditions: [
        { label: "360p", bitrateKbps: 496 },
        { label: "480p", bitrateKbps: 746 },
      ],
    });
    expect(applied).toBe(true);
    expect(tx.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: assetId, status: "PROCESSING" },
      data: { status: "READY", durationSeconds: 61, failureReason: null },
    });
    expect(tx.videoRendition.deleteMany).toHaveBeenCalledWith({ where: { assetId } });
    expect(tx.videoRendition.createMany).toHaveBeenCalledWith({
      data: [
        { assetId, label: "360p", bitrateKbps: 496 },
        { assetId, label: "480p", bitrateKbps: 746 },
      ],
    });
  });

  test("writes no renditions when the asset is no longer processing", async () => {
    const { store, tx } = build({ count: 0 });
    expect(await store.markReady(assetId, { durationSeconds: 1, renditions: [] })).toBe(false);
    expect(tx.videoRendition.createMany).not.toHaveBeenCalled();
  });
});

describe("PrismaTranscodeStore.markFailed", () => {
  test("stores the reason on an asset that is still processing", async () => {
    const { store, database } = build();
    await store.markFailed(assetId, "TIMED_OUT");
    expect(database.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: assetId, status: "PROCESSING" },
      data: { status: "FAILED", failureReason: "TIMED_OUT" },
    });
  });
});
