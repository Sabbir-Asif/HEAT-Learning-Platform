import { describe, expect, test } from "vitest";
import {
  automaticChoice,
  bandwidthEstimateKey,
  qualityChoiceKey,
  readBandwidthEstimate,
  readQualityChoice,
  writeBandwidthEstimate,
  writeQualityChoice,
} from "../../src/player/preferences";
import type { PreferenceStorage } from "../../src/player/preferences";

const memoryStorage = (): PreferenceStorage & { items: Map<string, string> } => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
};

const brokenStorage: PreferenceStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("quality choice", () => {
  test("defaults to automatic", () => {
    expect(readQualityChoice(memoryStorage())).toBe(automaticChoice);
    expect(readQualityChoice(null)).toBe(automaticChoice);
  });

  test("remembers a manual choice for the next video", () => {
    const storage = memoryStorage();
    writeQualityChoice(storage, "480p");
    expect(readQualityChoice(storage)).toBe("480p");
  });

  test("ignores a stored value that is not a resolution", () => {
    const storage = memoryStorage();
    storage.items.set(qualityChoiceKey, "<script>");
    expect(readQualityChoice(storage)).toBe(automaticChoice);
  });

  test("survives blocked storage", () => {
    expect(() => writeQualityChoice(brokenStorage, "720p")).not.toThrow();
    expect(readQualityChoice(brokenStorage)).toBe(automaticChoice);
  });
});

describe("bandwidth estimate", () => {
  test("is absent until saved", () => {
    expect(readBandwidthEstimate(memoryStorage())).toBeNull();
  });

  test("round trips a saved estimate", () => {
    const storage = memoryStorage();
    writeBandwidthEstimate(storage, 1234567.8);
    expect(readBandwidthEstimate(storage)).toBe(1234568);
  });

  test("does not save an unusable estimate", () => {
    const storage = memoryStorage();
    writeBandwidthEstimate(storage, Number.NaN);
    writeBandwidthEstimate(storage, 0);
    expect(storage.items.has(bandwidthEstimateKey)).toBe(false);
  });

  test("rejects a corrupt stored value and survives blocked storage", () => {
    const storage = memoryStorage();
    storage.items.set(bandwidthEstimateKey, "abc");
    expect(readBandwidthEstimate(storage)).toBeNull();
    expect(readBandwidthEstimate(brokenStorage)).toBeNull();
    expect(() => writeBandwidthEstimate(brokenStorage, 1000)).not.toThrow();
  });
});
