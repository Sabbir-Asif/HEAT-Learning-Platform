export const qualityChoiceKey = "heat.player.quality";
export const bandwidthEstimateKey = "heat.player.bandwidth";
export const automaticChoice = "auto";

export interface PreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export const browserStorage = (): PreferenceStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const read = (storage: PreferenceStorage | null, key: string): string | null => {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
};

const write = (storage: PreferenceStorage | null, key: string, value: string): void => {
  try {
    storage?.setItem(key, value);
  } catch {
    return;
  }
};

export const readQualityChoice = (storage: PreferenceStorage | null): string => {
  const value = read(storage, qualityChoiceKey);
  return value !== null && /^\d{3,4}p$/.test(value) ? value : automaticChoice;
};

export const writeQualityChoice = (storage: PreferenceStorage | null, choice: string): void => {
  write(storage, qualityChoiceKey, choice);
};

export const readBandwidthEstimate = (storage: PreferenceStorage | null): number | null => {
  const value = Number(read(storage, bandwidthEstimateKey));
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const writeBandwidthEstimate = (
  storage: PreferenceStorage | null,
  bitsPerSecond: number,
): void => {
  if (Number.isFinite(bitsPerSecond) && bitsPerSecond > 0) {
    write(storage, bandwidthEstimateKey, String(Math.round(bitsPerSecond)));
  }
};
