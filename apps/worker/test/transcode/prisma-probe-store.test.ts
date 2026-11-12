import { describe, expect, test, vi } from "vitest";
import { PrismaProbeStore } from "../../src/transcode/prisma-probe-store";

const assetId = "0194f3a0-0000-7000-8000-000000000009";

const build = (count = 1) => {
  const tx = {
    videoAsset: { updateMany: vi.fn().mockResolvedValue({ count }) },
    outbox: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    videoAsset: { findFirst: vi.fn().mockResolvedValue({ assetKey: "key" }) },
    $transaction: vi.fn().mockImplementation((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { store: new PrismaProbeStore(database as never), tx, database };
};

describe("PrismaProbeStore", () => {
  test("finds only an asset that is waiting for its probe", async () => {
    const { store, database } = build();
    expect(await store.findUploaded(assetId)).toEqual({ assetKey: "key" });
    expect(database.videoAsset.findFirst).toHaveBeenCalledWith({
      where: { id: assetId, status: "UPLOADED" },
      select: { assetKey: true },
    });
  });

  test("queues the asset and writes the transcode event in the same transaction", async () => {
    const { store, tx } = build();
    expect(await store.apply(assetId, { status: "QUEUED", durationSeconds: 61 })).toBe(true);
    expect(tx.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: assetId, status: "UPLOADED" },
      data: { status: "QUEUED", durationSeconds: 61, rejectionReason: null },
    });
    expect(tx.outbox.create).toHaveBeenCalledWith({
      data: { eventType: "video.queued", payload: { assetId } },
    });
  });

  test("rejects the asset with its reason and enqueues nothing", async () => {
    const { store, tx } = build();
    expect(await store.apply(assetId, { status: "REJECTED", reason: "UNSUPPORTED_CODEC" })).toBe(
      true,
    );
    expect(tx.videoAsset.updateMany).toHaveBeenCalledWith({
      where: { id: assetId, status: "UPLOADED" },
      data: { status: "REJECTED", rejectionReason: "UNSUPPORTED_CODEC" },
    });
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });

  test("does nothing when the asset already left the uploaded state", async () => {
    const { store, tx } = build(0);
    expect(await store.apply(assetId, { status: "QUEUED", durationSeconds: 10 })).toBe(false);
    expect(tx.outbox.create).not.toHaveBeenCalled();
  });
});
